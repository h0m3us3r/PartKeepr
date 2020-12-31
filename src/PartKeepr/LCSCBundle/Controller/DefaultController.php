<?php

namespace PartKeepr\LCSCBundle\Controller;

use FOS\RestBundle\Controller\Annotations\View;
use FOS\RestBundle\Controller\FOSRestController;
use Sensio\Bundle\FrameworkExtraBundle\Configuration as Routing;
use Symfony\Component\HttpFoundation\Request;

class DefaultController extends FOSRestController
{
    /**
     * @Routing\Route("/api/lcsc/get/{id}", defaults={"method" = "GET","_format" = "json"})
     * @Routing\Method({"GET"})
     *
     * @param $id string the Part UID
     *
     * @View()
     *
     * @return \stdClass
     */
    public function indexAction($id)
    {
        $data = $this->get("partkeepr.lcsc_service")->getPartByUID($id);

        return $data;
    }

    /**
     * @Routing\Route("/api/lcsc/query/", defaults={"method" = "GET","_format" = "json"})
     * @Routing\Method({"GET"})
     *
     * @param Request $request
     *
     * @View()
     *
     * @return array
     */
    public function getPartsByQueryAction(Request $request)
    {
        $start = 1;

        $responseData = [];
        $responseData['results'] = [];
        $responseData['error'] = null;
        $responseData['hits'] = null;

        $query = $request->query->get('q');

        if ($request->query->has('page')) {
            $start = $request->query->get('page');
        }

        $data = $this->get("partkeepr.lcsc_service")->getPartyByQuery($query, $start);

        if ($data === null) {
            $responseData['error'] = "LCSC did not return a valid JSON";
            return $responseData;
        }

        if (!$data['success']) {
            $responseData['error'] = $responseData['message'];
            return $responseData;
        }

        $parts = $data['result']['transData'];
        $responseData['hits'] = count($parts);

        foreach ($parts as $part) {
            $responseItem = [];
            $responseItem['mpn'] = $part['info']['number'];
            $responseItem['description'] = $part['description'];
            $categories = explode('|', $part['categories'][0]);
            $responseItem['category'] = end($categories);
            $responseItem['package'] = $part['package'];
            $responseItem['stock'] = $part['stock'];
            $responseItem['manufacturer'] = $part['manufacturer']['en'];
            $responseItem['url'] = "https://lcsc.com" . $part['url'];
            $responseItem['uid'] = $part['number'];
            $responseData['results'][] = $responseItem;
        }

        return $responseData;
    }
}
