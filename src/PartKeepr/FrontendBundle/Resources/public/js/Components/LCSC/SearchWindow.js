Ext.define("PartKeepr.Components.LCSC.SearchWindow", {
    extend: "Ext.window.Window",
    title: i18n("LCSC Search"),
    iconCls: "partkeepr-icon lcsc",
    width: 750,
    height: 300,
    layout: 'fit',
    modal: true,
    items: [
        {
            xtype: "lcscSearchPanel",
            itemId: 'lcscSearchPanel'
        }
    ],
    initComponent: function () {
        this.callParent(arguments);
        this.down("#lcscSearchPanel").on("refreshData", function () {
            this.fireEvent("refreshData");
        }, this);
    },
    startSearch: function (query) {
        this.down("#lcscSearchPanel").startSearch(query);
    },
    setPart: function (part) {
        this.down("#lcscSearchPanel").setPart(part);
    }
});
