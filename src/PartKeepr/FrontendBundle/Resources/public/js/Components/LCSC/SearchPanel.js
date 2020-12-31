Ext.define("PartKeepr.Components.LCSC.SearchPanel", {
    extend: "Ext.panel.Panel",
    layout: 'border',
    grid: null,
    store: null,
    searchBar: null,
    xtype: 'lcscSearchPanel',

    initComponent: function () {
        this.store = Ext.create("Ext.data.Store", {
            fields: [
                { name: 'title', type: 'string' },
                { name: 'url', type: 'string' },
                { name: 'mpn', type: 'string' },
                { name: 'numOffers', type: 'int' },
                { name: 'numDatasheets', type: 'int' },
                { name: 'numSpecs', type: 'int' }
            ],
            proxy: {
                type: 'ajax',
                startParam: '',
                limitParam: '',
                url: "",
                reader: {
                    type: 'json',
                    totalProperty: 'hits',
                    rootProperty: 'results',
                    transform: this.checkForErrors
                }
            },
            autoLoad: false
        });

        this.grid = Ext.create({
            xtype: 'grid',
            region: 'center',
            columns: [
                {
                    text: i18n("MPN"),
                    dataIndex: 'mpn',
                    flex: 18,
                    renderer: (v) => Ext.util.Format.htmlDecode(v)
                    // LCSC returns MPNs with highlighting of search query with <span>
                    // We display them as HTML to preserve highligting which is nice to have
                    // This is unsafe though as it opens the door for XSS...
                    // TODO: come up with a safer way of doing above described.
                }, {
                    text: i18n("Manufacturer"),
                    dataIndex: 'manufacturer',
                    flex: 18
                }, {
                    text: i18n("Description"),
                    dataIndex: 'description',
                    flex: 30
                }, {
                    text: i18n("Category"),
                    dataIndex: 'category',
                    flex: 20
                }, {
                    text: i18n("Package"),
                    dataIndex: 'package',
                    flex: 15
                }, {
                    text: i18n("Stock"),
                    dataIndex: 'stock',
                    flex: 8
                }, {
                    text: i18n("Details"),
                    dataIndex: 'url',
                    flex: 12,
                    renderer: (v) => '<span class="web-icon fugue-icon globe-small"/></span><a href="' + v + '" target="_blank">' + i18n("Details") + "</a>"
                }
            ],
            store: this.store
        });

        this.addButton = Ext.create("Ext.button.Button", {
            iconCls: 'fugue-icon blueprint--plus',
            text: i18n("Add Data"),
            disabled: true,
            itemId: 'add',
            handler: this.onAddClick,
            scope: this
        });

        this.grid.addDocked(Ext.create("Ext.toolbar.Toolbar", {
            dock: 'bottom',
            enableOverflow: true,
            items: [{
                xtype: 'checkbox',
                itemId: "importParameters",
                checked: PartKeepr.getApplication().getUserPreference("partkeepr.octopart.importParameters", true),
                boxLabel: i18n("Parameters")
            }, {
                xtype: 'checkbox',
                itemId: "importDatasheet",
                checked: PartKeepr.getApplication().getUserPreference("partkeepr.octopart.importBestDatasheet", true),
                boxLabel: i18n("Datasheet")
            }, {
                xtype: 'checkbox',
                itemId: "importImages",
                checked: PartKeepr.getApplication().getUserPreference("partkeepr.octopart.importImages", true),
                boxLabel: i18n("Images")
            }, {
                xtype: 'checkbox',
                itemId: "importPrices",
                checked: PartKeepr.getApplication().getUserPreference("partkeepr.octopart.importDistributors", true),
                boxLabel: i18n("Prices")
            }]
        }));

        this.grid.addDocked(Ext.create("Ext.toolbar.Paging", {
            store: this.store,
            enableOverflow: true,
            dock: 'bottom',
            displayInfo: false,
            grid: this.grid,
            items: this.addButton
        }));



        this.searchBar = Ext.create("Ext.form.field.Text", {
            region: 'north',
            height: 30,
            emptyText: i18n("Enter Search Terms"),
            listeners: {
                specialkey: function (field, e) {
                    if (e.getKey() === e.ENTER) {
                        this.startSearch(field.getValue());
                    }

                },
                scope: this
            }
        });

        this.items = [this.grid, this.searchBar];

        this.grid.on("itemdblclick", this.onItemDblClick, this);
        this.grid.on('selectionchange',
            this.onSelectChange,
            this);

        this.store.on("load", this.checkForApiError, this);

        this.callParent(arguments);

    },
    onAddClick: function () {
        var record = this.grid.getSelection()[0];
        this.applyData(record);
    },
    onSelectChange: function (selModel, selections) {
        this.addButton.setDisabled(selections.length === 0);
    },
    setPart: function (part) {
        this.part = part;
    },
    onItemDblClick: function (grid, record) {
        this.applyData(record);
    },
    applyData: function (record) {
        var j = Ext.create("PartKeepr.Components.LCSC.DataApplicator");

        j.setPart(this.part);

        j.setImport("parameters", this.down("#importParameters").getValue());
        j.setImport("datasheet", this.down("#importDatasheet").getValue());
        j.setImport("images", this.down("#importImages").getValue());
        j.setImport("prices", this.down("#importPrices").getValue());

        j.loadData(record.get("uid"));

        j.on("refreshData", function () {
            this.fireEvent("refreshData");
        }, this);
    },
    startSearch: function (query) {
        this.store.getProxy().setUrl(
            PartKeepr.getBasePath() + '/api/lcsc/query/?q=' + encodeURIComponent(query)
        );
        this.store.load();
        this.searchBar.setValue(query);
    },
    checkForErrors: function (data) {
        if (data.error !== null) {
            Ext.Msg.alert(i18n("LCSC Error"), data.error);
        }

        return data;
    },
    checkForApiError: function (store, records, successful, eOpts) {
        if (!successful) {
            Ext.Msg.alert(i18n("LCSC Error"), "PartKeepr cannot access LCSC");
        }
    }
});
