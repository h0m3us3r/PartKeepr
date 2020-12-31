Ext.define("PartKeepr.Components.LCSC.DataApplicator", {
    extend: "Ext.Base",
    mixins: ['Ext.mixin.Observable'],

    import: {},

    constructor: function (config) {
        this.setImport("parameters", true);
        this.setImport("datasheet", true);
        this.setImport("images", true);
        this.setImport("prices", true);

        this.mixins.observable.constructor.call(this, config);
    },
    setImport: function (item, flag) {
        this.import[item] = flag;
    },
    setPart: function (part) {
        this.part = part;
    },
    /**
     * Loads the data via the PartKeepr API from LCSCC.
     *
     * @param {String} id The LCSC UID to load
     */
    loadData: function (id) {
        Ext.Ajax.request({
            url: PartKeepr.getBasePath() + '/api/lcsc/get/' + id,
            success: this.onPartDataLoaded,
            scope: this
        });
    },
    /**
     * Called after the LCSC Part data has been loaded.
     *
     * @param {Object} response The response data
     */
    onPartDataLoaded: function (response) {
        this.data = Ext.decode(response.responseText);

        this.applyData();
    },
    checkRequirements: function () {
        var i, unit, datasheet, image, distributor;

        var manufacturer = PartKeepr.getApplication().getManufacturerStore().findRecord("name",
            this.data.manufacturer);
        if (manufacturer === null) {
            this.displayWaitWindow(i18n("Creating Manufacturer…"), this.data.manufacturer);
            manufacturer = Ext.create("PartKeepr.ManufacturerBundle.Entity.Manufacturer");
            manufacturer.set("name", this.data.manufacturer);
            manufacturer.save({
                success: function () {
                    PartKeepr.getApplication().getManufacturerStore().load({
                        callback: this.applyData,
                        scope: this
                    });
                },
                scope: this

            });
            return false;
        }

        if (this.import.parameters) {
            for (const [key, value] of Object.entries(this.data.specs)) {
                var q_value, q_unit, q_siPrefix;
                [q_value, q_unit] = this.parseQuantity(value);
                [q_value, q_unit2, q_siPrefix] = this.SIUnitPrefix(q_value, q_unit);
                if (q_unit2 === null && q_unit) {
                    // there is a unit (q_unit), but we do not know about it or the prefix of the unit is disabled
                    unit = PartKeepr.getApplication().getUnitStore().findRecord("symbol",
                        q_unit, 0, false, true, true);
                    if (unit === null) {
                        this.displayWaitWindow(i18n("Creating Unit…"), q_unit);
                        unit = Ext.create("PartKeepr.UnitBundle.Entity.Unit");
                        unit.set("name", q_unit); // v4 API does not have that anymore
                        unit.set("symbol", q_unit);
                        unit.save({
                            success: function () {
                                PartKeepr.getApplication().getUnitStore().load({
                                    callback: this.applyData,
                                    scope: this
                                });
                            },
                            scope: this

                        });
                        return false;
                    }
                }
            }
        }

        if (this.import.datasheet) {
            if (this.data['datasheet']) {
                datasheet = this.data.datasheet;
                delete this.data.datasheet;
                this.displayWaitWindow(i18n("Uploading datasheet…"), datasheet);

                if (!this.checkIfAttachmentFilenameExists(datasheet)) {
                    PartKeepr.getApplication().uploadFileFromURL(datasheet, i18n("Datasheet"), this.onFileUploaded,
                        this);
                } else {
                    this.applyData();
                }

                return false;
            }
        }

        if (this.import.images) {
            if (Array.isArray(this.data['images']) && this.data['images'].length) {
                image = this.data['images'].shift();

                this.displayWaitWindow(i18n("Uploading Image…"), image);
                if (!this.checkIfAttachmentFilenameExists(image)) {
                    PartKeepr.getApplication().uploadFileFromURL(image, i18n("Image"), this.onFileUploaded,
                        this);
                } else {
                    this.applyData();
                }

                return false;
            }
        }

        return true;
    },
    checkIfAttachmentFilenameExists: function (uri) {
        var k, found, filename = uri.split(/[\\/]/).pop();

        found = false;

        for (k = 0; k < this.part.attachments().count(); k++) {
            if (this.part.attachments().getAt(k).get("originalFilename") === filename) {
                found = true;
            }
        }

        return found;
    },
    onFileUploaded: function (options, success, response) {
        if (success) {
            var result = Ext.decode(response.responseText);

            var uploadedFile = Ext.create("PartKeepr.UploadedFileBundle.Entity.TempUploadedFile", result.response);

            this.part.attachments().add(uploadedFile);
        }

        this.applyData();
    },
    displayWaitWindow: function (text, value) {
        this.waitMessage = Ext.MessageBox.show({
            msg: text + "<br/>" + value,
            progressText: value,
            width: 300,
            wait: {
                interval: 100
            }
        });
    },
    applyData: function () {
        var spec, i, unit, value, siPrefix, distributor, j, partDistributor, k, found;

        if (this.waitMessage instanceof Ext.window.MessageBox) {
            this.waitMessage.hide();
        }

        if (!this.checkRequirements()) {
            return;
        }

        this.part.set("name", this.data.mpn);
        if (this.data.description)
            this.part.set("description", this.data.description);

        if (this.data.manufacturer) {
            var manufacturer = PartKeepr.getApplication().getManufacturerStore().findRecord("name",
                this.data.manufacturer);
            var partManufacturer;

            if (manufacturer === null) {
                // @todo put out error message
            }

            partManufacturer = Ext.create("PartKeepr.PartBundle.Entity.PartManufacturer");
            partManufacturer.setManufacturer(manufacturer);
            partManufacturer.set("partNumber", this.data.mpn);

            found = null;

            for (k = 0; k < this.part.manufacturers().count(); k++) {
                if (this.part.manufacturers().getAt(k).isPartiallyEqualTo(partManufacturer,
                    ["manufacturer.name"])) {
                    found = this.part.manufacturers().getAt(k);
                }
            }

            if (found !== null) {
                found.set("partNumber", this.data.mpn);
            } else {
                this.part.manufacturers().add(partManufacturer);
            }
        }

        if (this.data.package) {
            spec = Ext.create("PartKeepr.PartBundle.Entity.PartParameter");
            spec.set("name", "Case/Package");
            spec.set("valueType", "string");
            spec.set("stringValue", this.data.package);

            for (k = 0; k < this.part.parameters().count(); k++) {
                if (spec.isPartiallyEqualTo(
                    this.part.parameters().getAt(k),
                    ["name"]
                )) {
                    found = this.part.parameters().getAt(k);
                }
            }

            if (found === null) {
                this.part.parameters().add(spec);
            }
        }

        if (this.import.parameters) {
            for (const [key, value] of Object.entries(this.data.specs)) {
                spec = Ext.create("PartKeepr.PartBundle.Entity.PartParameter");
                spec.set("name", key);

                var q_value, q_unit;
                [q_value, q_unit] = this.parseQuantity(value);

                if (q_value != null && q_unit != null) {
                    [val, unit, siPrefix] = this.SIUnitPrefix(q_value, q_unit);
                    if (val && unit && siPrefix) {
                        spec.setUnit(unit);
                        spec.set("value", val);
                        spec.setSiPrefix(siPrefix);
                    } else {
                        unit = PartKeepr.getApplication().getUnitStore().findRecord("symbol",
                            q_unit, 0, false, true, true);
                        spec.setUnit(unit);
                        siPrefix = this.findSiPrefixForValueAndUnit(q_value, unit);
                        spec.set("value", this.applySiPrefix(q_value, siPrefix));
                        spec.setSiPrefix(siPrefix);
                    }
                    spec.set("valueType", "numeric");
                }
                else if (q_value != null) {
                    spec.set("valueType", "numeric");
                    spec.set("value", q_value);
                }
                else {
                    spec.set("valueType", "string");
                    spec.set("stringValue", value);
                }

                found = null;

                for (k = 0; k < this.part.parameters().count(); k++) {
                    if (spec.isPartiallyEqualTo(
                        this.part.parameters().getAt(k),
                        ["name"]
                    )) {
                        found = this.part.parameters().getAt(k);
                    }
                }

                if (found === null) {
                    this.part.parameters().add(spec);
                }
            }
        }

        this.fireEvent("refreshData");
    },
    applySiPrefix: function (value, siPrefix) {
        return Ext.util.Format.round(value / Math.pow(siPrefix.get("base"), siPrefix.get("exponent")), 3);
    },
    findSiPrefixForValueAndUnit: function (value, unit) {
        var i, prefixedValue, siPrefix;

        siPrefix = PartKeepr.getApplication().getSiPrefixStore().findRecord("exponent", 0, 0, false, false, true);

        if (!(unit instanceof PartKeepr.UnitBundle.Entity.Unit)) {
            return siPrefix;
        }

        unit.prefixes().sort("exponent", "desc");

        for (i = 0; i < unit.prefixes().getCount(); i++) {
            siPrefix = unit.prefixes().getAt(i);
            prefixedValue = Math.abs(this.applySiPrefix(value, siPrefix));

            if (prefixedValue < 1000 && prefixedValue > 0.9) {
                break;
            }
        }

        return siPrefix;
    },
    parseQuantity: function (quantity) {
        try {
            quantity = quantity.trim();
            const regex = /[^\d+-.]/g;
            var idx = quantity.search(regex);
            if (idx == -1) {
                // no unit, but maybe value only
                var value = parseFloat(quantity);
                if (!isNaN(value)) {
                    return [value, null];
                }
            } else {
                var value = parseFloat(quantity.slice(0, idx));
                if (isNaN(value))
                    return [null, null];
                var unit = quantity.slice(idx).trim();
                return [value, unit];
            }
        }
        finally { }
        return [null, null];
    },
    SIUnitPrefix: function (q_value, q_unit) {
        // check if the unit as a whole is already known
        var unit = PartKeepr.getApplication().getUnitStore().findRecord("symbol", q_unit, 0, false, true, true);
        if (unit) {
            var siPrefix = PartKeepr.getApplication().getSiPrefixStore().findRecord("exponent", 0, 0, false, false, true);
            return [q_value, unit, siPrefix];
        }

        // assume the first character is an SI-prefix
        if (q_unit && q_unit.length >= 2) {
            unit = PartKeepr.getApplication().getUnitStore().findRecord("symbol", q_unit.substring(1), 0, false, true, true);
            if (unit) {
                // now check that the first character is a valid SI-prefix
                console.log(unit);
                var siPrefix;
                for (var i = 0; i < unit.prefixes().getData().length; i++) {
                    var temp = unit.prefixes().getData().getAt(i);
                    var prefixChar = temp.get("symbol");
                    if (prefixChar == "μ")
                        prefixChar = "µ"; // convert upper case µ to lower case µ
                    if (q_unit[0] == prefixChar) {
                        siPrefix = temp;
                        break;
                    }
                }
                if (siPrefix) {
                    return [q_value, unit, siPrefix];
                }
            }
        }

        // no matching unit found
        return [null, null, null];
    }
});
