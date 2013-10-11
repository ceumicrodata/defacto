var tickFormatFunctions = {
 "dateAxisDefault" : function(date) 
  { return d3.time.format( date.getMonth() ? "%b" : "%Y")(date); },
 "valueAxisDefault" : d3.format("g")
}

var adaptiveYAxisFunctions = { 
 "maxValueDefault" : function( maxVisibleValue, previousMaxValue) 
  { return Math.ceil(maxVisibleValue / 4) * 4; },
 "minValueDefault" : function( minVisibleValue, previousMinValue) 
  { return Math.floor(minVisibleValue / 4) * 4; }
}

var tooltipTextFunctions = { 
  "simpleTooltip" : function(serieName, tooltipDate, tooltipValue) 
    { return serieName + " | " + tooltipDate + " | " + tooltipValue ;  }
}

var colorFunctions = {
  "colorTable0"   : function(i) { return _C("base",i); },  //see colours/colours.js;
  "colorTable1"   : function(i) { return _C("ct1",i); },    //see colours/colours.js;
  "colorTable2"   : function(i) { return _C("ct2",i); }   //see colours/colours.js;
}
 
 
function isSerieVisible(visibleStatus,keyPath) {
  return visibleStatus == keyPath || visibleStatus == "*";
}
 
