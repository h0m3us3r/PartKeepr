<?php

namespace PartKeepr\LCSCBundle\Services;

use DOMDocument;
use DomXPath;
use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use Predis\Client as PredisClient;

class LCSCService
{
    /*
    public function __construct($apiKey, $limit)
    {
        $this->apiKey = $apiKey;
        $this->limit = $limit;
    }
    */

    public function getPartByUID($uid)
    {
        $client = new Client();

        $url = null;

        try {
            $redisclient = new PredisClient();
            $redisclient->connect();
            $url = $redisclient->get($uid);
            $redisclient->disconnect();
        } catch (\Exception $e) {
        }

        if ($url === null) {
            $response = $client->request('GET', "https://lcsc.com/api/global/additional/search", [
                'query' => ['q' => $uid]
            ]);

            $response = json_decode($response->getBody(), true);

            if (isset($response['result']['links']) && !empty($response['result']['links'])) {
                $url = $response['result']['links'];
            } else {
                return ['error' => true, 'msg' => "Cannot get product URL."];
            }
        }

        $response = $client->request('GET', "https://lcsc.com" . $url);

        $page = new DOMDocument();
        $page->loadHTML($response->getBody(), LIBXML_NOWARNING | LIBXML_NOERROR);
        $finder = new DomXPath($page);

        $mpn = $finder->query("//td[contains(@class, 'detail-mpn-title')]")[0];
        if (empty($mpn)) {
            return ['error' => true, 'msg' => "Cannot find product's MPN in DOM."];
        }
        $part['mpn'] = $mpn->nodeValue;

        $desc = $finder->query("//table[contains(@class, 'info-table')]/tbody/tr/td/p");
        $desc = $desc->item($desc->length-1);
        if (!empty($desc)) {
            $part['description'] = $desc->nodeValue;
        }

        $imgs = $finder->query("//img[contains(@class, 'main-img')]");
        foreach ($imgs as $img) {
            $part['images'][] = $img->getAttribute('data-original');
        }

        $specs = $finder->query("//table[contains(@class, 'products-specifications')]/tbody/tr");
        if (empty($specs)) {
            return ['error' => true, 'msg' => "Cannot find product's specs in DOM."];
        }

        foreach ($specs as $spec) {
            $vals = $spec->getElementsByTagName('td');

            $attribute = $vals->item(0)->nodeValue;
            $value = $vals->item(1);

            switch ($attribute) {
                case "Category":
                    continue;
                case "Datasheet":
                    $part['datasheet'] = $value->getElementsByTagName('p')->item(0)->getElementsByTagName('a')->item(0)->getAttribute('href');
                    break;
                case "RoHS":
                    continue;
                case "Package":
                    $part['package'] = $value->nodeValue;
                    break;
                case "Manufacturer":
                    $part['manufacturer'] = $value->nodeValue;
                    break;
                case "Brand Category":
                    continue;
                case "Packaging":
                    continue;
                default:
				    $part['specs'][$attribute] = trim($value->nodeValue);
            }
        }

        return $part;
    }

    public function getPartyByQuery($q, $startpage = 1)
    {
        $jar = new CookieJar();

        $auth = $this->getAuth($jar);

        $client = new Client(['cookies' => $jar]);

        $response = $client->request('POST', "https://lcsc.com/api/global/search", [
            'query' => ['q' => $q],
            'headers' => $auth
        ]);

        $parts = json_decode($response->getBody(), true);

        try {
            $redisclient = new PredisClient();
            $redisclient->connect();
            $results = $parts['result']['transData'];
            foreach ($results as $result) {
                $redisclient->set($result['number'], $result['url']);
            }
            $redisclient->disconnect();
        } catch (\Exception $e) {
        }

        return $parts;
    }

    function getAuth($cookieJar)
    {
        $client = new Client(['cookies' => $cookieJar]);
        $response = $client->request('GET', "https://lcsc.com/brand-detail/11573.html");

        preg_match("/'X-CSRF-TOKEN': '(\\w*)'/", $response->getBody(), $token);
        $auth['X-CSRF-TOKEN'] = $token[1];

        return $auth;
    }
}
