var pages = { 
  "{{topic}}" : {
    "title" : "{{topic.title}}",
    "charts" : {
      {% for chart in topic.charts %}
      "{{chart.shortname}}" : {   
        "title" : "{{chart.title}}",
        "description" : "{{chart.description}}",

        // format
        "valueFormat" : d3.format("{{chart.format}}"), // see https://github.com/mbostock/d3/wiki/Formatting

        // time and value extents
        "dateMin"  : "1990-01" ,   //formatted based on the "dateFormat" settings
        "dateMax"  : "2013-03" ,   //formatted based on the "dateFormat" settings
        "valueMin" : 4,
        "valueMax" : 16,

        // the initially visible time interval
        "dateFrom" : "2003-03" ,   //formatted based on the "dateFormat" settings
        "dateTo"   : "2013-03" ,   //formatted based on the "dateFormat" settings
        
        // formatting of axes
        "valueAxis" : {
          "tickCount": 5, //number of main ticks on the y axis
          "subdivide" : 1,   //number of "subticks" between main ticks
          "tickFormat": d3.format("g") ,
          
          //adaptive y axis functions: 
          "maxValue" : function( maxVisibleValue, previousMaxValue) { return Math.ceil(maxVisibleValue / 4) * 4; },
          "minValue" : function( minVisibleValue, previousMinValue) { return Math.floor(minVisibleValue / 4) * 4; }
        }, 
        
        //legend
        "legend" : {
          "showBarChart" : true,         //barchart or simple legend
          "dateOfBarChart" : "2012-01" , //formatted based on the "dateFormat" settings
        }, 
        
        //tooltip
        "tooltipText" : function(serieName, tooltipDate, tooltipValue) 
            { return serieName + " | " + tooltipDate + " | " + tooltipValue ;  },
        
        //shaded intervals
        {% if "shades" in chart %}
        "shadedIntervals" : [
        {% for shade in chart.shades %}
          {
            "label" :    "shade1" ,     // label of the area
            "tooltip" :  "shade1" ,     // tooltip of the area
            "dateFrom" : "1990-04" , // formatted based on the "dateFormat" settings
            "dateTo" :   "1994-04" , // formatted based on the "dateFormat" settings
            "color" :    "#ffdddd"      // color of the area
          },
        {% endfor %}
        ],
        {% endif %} 
        
        //queries
        "queries" : [
          {    
            "isVisible" : function(keyPath) { return true; },  //REFERENCE COUNTRY: always visible
            "tableName" : "countries",
            "serieKey"  : "country", 
            "dateKey"   : "date",     
            "valueKey"  : "uemp",  
            "filter"    : "`country` = 'hungary'", 
            "color"     : "#ff0000", 
            "thickness" : 4, 
            "onClick"   : 0         
          },
          {
            "isVisible" : function(keyPath) { return keyPath == ""; }, 
            "tableName" : "regions", 
            "serieKey"  : "region", 
            "dateKey"   : "date",     
            "valueKey"  : "uemp",  
            "color"     : function(i) { return _C("base",i); },  //see colours/colours.js;
            "thickness" : 2, 
            "onClick"   : +1        
          },
          {
            "isVisible" : function(keyPath) { return keyPath == "v4"; }, 
            "tableName" : "countries", 
            "serieKey"  : "country",    
            "dateKey"   : "date",        
            "valueKey"  : "uemp",       
            "join"      : "`countriesInRegions` ON `countriesInRegions`.`country` = `countries`.`country`", 
            "filter"    : "`region` = 'v4'",    
            "color"     : function(i) { return _C("ct1",i); }, //see colours/colours.js;
            "thickness" : 2,        
            "onClick"   : 0           
          }, 
          {
            "isVisible" : function(keyPath) { return keyPath == "eu15"; }, 
            "tableName" : "countries", 
            "serieKey"  : "country", 
            "dateKey"   : "date",     
            "valueKey"  : "uemp",  
            "join"      : "`countriesInRegions` ON `countriesInRegions`.`country` = `countries`.`country`", 
            "filter"    : "`region` = 'eu15'",    
            "color"     : function(i) { return _C("ct2",i); }, //see colours/colours.js;
            "thickness" : 2,        
            "onClick"   : 0           
          } 
        ]
      },