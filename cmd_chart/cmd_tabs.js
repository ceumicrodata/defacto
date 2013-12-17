
//Draws the maim menu based on the metadata
function updateMainMenu(initialMainId) {
  
  var MAINMENU_ITEM_WIDTH = 180; //pt;
  var MAINMENU_ITEM_HEIGHT = 28; //pt;
  var MAINMENU_NUM_ITEMS_IN_ROW = 4; 
  var MAINMENU_NUM_ROWS = 2; 
   
  var mainMenu = d3.select(".mainMenu"); 
  var x = 0;
  var y = 0;
 
  for (var mainId in globalMetadata) {

      mainMenu.append("div")
      .classed("mainMenuItem", true)
      .classed(initialMainId == mainId ? "mainMenuItemActive" : "mainMenuItemNormal", true)
      .attr ("id" , "chartPath_" + mainId)
      .style ("left" , (x*MAINMENU_ITEM_WIDTH) + "pt")
      .style ("top"  , (y*MAINMENU_ITEM_HEIGHT) + "pt")
      .text(globalMetadata[mainId].title)
      .on("mouseover", function () { 
        var v = d3.select(this);
        if (v.classed("mainMenuItemNormal")) {
          v.classed("mainMenuItemNormal", false)
           .classed("mainMenuItemHover", true);
        }
      })
      .on("mouseout", function () {
        var v = d3.select(this);
        if (v.classed("mainMenuItemHover"))
          v.classed("mainMenuItemHover", false)
           .classed("mainMenuItemNormal", true);
      })
      .on("click", function () {  
        changeChart(d3.select(this).attr("id").replace("chartPath_", ""));    
      });

      if (x<MAINMENU_NUM_ITEMS_IN_ROW-1)
        x++
      else {
        x=0; y++;
      }
      
   }
   
   /*for (var pp = x; pp< MAINMENU_NUM_ITEMS_IN_ROW; pp++) 
      mainMenu.append("div")
      .classed("mainMenuItem", true)
      .classed("mainMenuItemInactive", true)
      .style ("left" , (pp*120) + "pt")
      .style ("top"  , (y*MAINMENU_ITEM_HEIGHT) + "pt") 
      .text("  ");*/
      
}

//Draws the submenu based on the metadata
function updateSubMenu(mainId, initialSubId) {
   
  var subMenu = d3.select(".subMenu");
  subMenu.html("");
  
  var s = 0;

  for (var subId in globalMetadata[mainId].charts) {
    
   subMenu.append("span")
    .classed("subMenuItem", true)
    .classed(initialSubId == subId ? "subMenuItemActive subMenuItemHover" : "subMenuItemNormal", true)
    .attr ("id" , "chartPath_" + mainId + "_" +subId)
    .text(globalMetadata[mainId].charts[subId].title)
    .on("mouseover", function () { 
      d3.select(".subMenuItemHover").classed("subMenuItemHover", false);
      d3.select(this).classed("subMenuItemHover", true);
    })
    .on("mouseout", function () {
      d3.select(this).classed("subMenuItemHover",false);
      d3.select(".subMenuItemActive").classed("subMenuItemHover",true);
    })
    .on("click", function () {  
      changeChart(d3.select(this).attr("id").replace("chartPath_", ""));    
    });
    s++;
   }
}
  
var lastInitialChartPath = null;
   
//calling globalStateManager.changeState() directly: onclick, website initialization
function changeChart(chartPath) {
  var url = "?chartPath="+chartPath;
  var title = "CEU Microdata"; //TODO
  lastInitialChartPath = chartPath;
  globalStateManager.changeState( { "chartPath" : chartPath }, title,  url );
  
  d3.select("body")
    .on("keydown", function() {
        if (d3.event.keyCode == 27 && lastInitialChartPath)
            changeChart(lastInitialChartPath);
        });
}

//changing the chart
var globalStateManager = new stateManager();
globalStateManager.changeChartFunction = function(stateData) {

  console.log (">>> globalStateManager.changeChartFunction : "+stateData.chartPath+": "+stateData.url+")");

  var mainKey = null;
  var subKey = null;
  
  //filling chartPath, if not complete
  if (stateData.chartPath == "") {
    mainKey = getFirstKey(globalMetadata); //getFirstKey: see utils.js
    subKey = getFirstKey(globalMetadata[mainKey].charts);
  } else {
    var chartPathParts = stateData.chartPath.split("_");
    if (chartPathParts.length == 2) {
      mainKey = chartPathParts[0];
      subKey = chartPathParts[1];
    } 
    else if (chartPathParts.length == 1) {
      mainKey = stateData.chartPath;
      subKey = getFirstKey(globalMetadata[mainKey].charts);
    } 
  }
  
  if (mainKey == null || subKey == null || !globalMetadata[mainKey] || !globalMetadata[mainKey].charts[subKey])  {
    alert ("Can't load chart ["+mainKey+"_"+subKey+"]");
    return;
  }

  //updating menus
  updateMainMenu(mainKey);
  updateSubMenu(mainKey, subKey);
  
  //creating the new chart
  var chartMetaData = globalMetadata[mainKey].charts[subKey]; 
  var validChartPath = mainKey + "_" + subKey;
  d3.select(".chartContainer").html("");
  d3.select("#chart1").call(cmd_chart, validChartPath, chartMetaData, 
     globalMetadataTemplates, globalMetadataDefaults, globalSettings, globalStateManager);
}
