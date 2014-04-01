var firstUse = true;

function cmd_chart(selection, stateData, metaData, metadataTemplates, metadataDefaults, appSettings, stateManager  ) {

  console.log ("MAIN ENTRY POINT: ");
  function applyMetadataDefaults() {
    for (var key in metadataDefaults) {
      if (metaData[key] === undefined)
          metaData[key] = metadataDefaults[key];      
    }
  }

  function applyMetadataTemplates(obj) {
    if (Array.isArray(obj)) {
      for (var i = 0; i<obj.length; i++)
        applyMetadataTemplates(obj[i]);
    } else if (typeof obj == "object") {
      for (var key in obj) {
        if (metadataTemplates[key] !== undefined && typeof (obj[key]) == "string"
            && metadataTemplates[key][obj[key]] !== undefined) {
          console.log("Metadata template replacement: " + key + ":" + [obj[key]]);
          obj[key] = metadataTemplates[key][obj[key]]; 
        }
        applyMetadataTemplates(obj[key]);        
      }
    }
  }
  ////////////////////////////////
  
  /*function getUrlSearchParams() {
      console.log (window.location.search.substring(1));
      var pairs = window.location.search.substring(1).split("&"),  obj = {}, pair, i;
      for (i in pairs) {
          pair = pairs[i].split("=");
          if (pair.length == 2) {
            var key = decodeURIComponent(pair[0]);
            var val = decodeURIComponent(pair[1]);
            if (key == "keyPath")
              obj["keyPath"] = val;
            else if (key == "dateFrom")
              obj["timeFrom"] = d3.time.format(metaData.dateFormat).parse(val).getTime();
            else if (key == "dateTo")
              obj["timeTo"] = d3.time.format(metaData.dateFormat).parse(val).getTime();
          }
      }
      return obj;
  }
  */
  ////////////////////////////////

  var keyPathIntervals = new mapOfIntervals();
  var currentPath = new KeyPath();
  var currentLegendData = null;
  var currentMinValue = false;
  var currentMaxValue = false;
  var previousMinValue = false;
  var previousMaxValue = false;
  var chartPath = stateData.chartPath;

  selection.select(".chartContainer").each(function () {
   
      var forceFullRedraw = true; //force Full Redraw for the first time
      
      applyMetadataDefaults();
      applyMetadataTemplates(metaData);

      function completeStateData(stateData) {
        if (stateData.keyPath === undefined)
            stateData.keyPath = currentPath.getPath();
        if (stateData.chartPath === undefined)
            stateData.chartPath = chartPath;
        if (stateData.isZoom === undefined)
            stateData.isZoom = false;

        var timeDomain = scalesTime.domain();

        if (stateData.timeFrom === undefined)
            stateData.timeFrom = (stateData.dateFrom === undefined)
               ? timeDomain[0].getTime()
               : d3.time.format(metaData.dateFormat).parse(stateData.dateFrom).getTime();
        if (stateData.timeTo === undefined)
            stateData.timeTo = (stateData.dateTo === undefined)
               ? timeDomain[1].getTime()
               : d3.time.format(metaData.dateFormat).parse(stateData.dateTo).getTime();   
      }
      function changeState(stateData) {

        completeStateData(stateData);

        var dateFrom = d3.time.format(metaData.dateFormat)(new Date(stateData.timeFrom));
        var dateTo = d3.time.format(metaData.dateFormat)(new Date(stateData.timeTo));
        var url = "?chartPath="+stateData.chartPath+"&keyPath=" + stateData.keyPath + "&dateFrom=" + dateFrom + "&dateTo=" + dateTo;
        var title = "Defacto"; //TODO

        if (stateManager.isHistoryEnabled) {
            stateManager.changeState(stateData, title, url);
        }
        else {
            loadDataAndRedraw(stateData);
        }
      }


      var series = new Object();

      var totalWidth = $(this).width();
      var totalHeight = $(this).height();

      var width = totalWidth - 3 * appSettings.margin - appSettings.legendWidth;
      var height = totalHeight - 2 * appSettings.margin - appSettings.descriptionZoneHeight;

      var timeMin = d3.time.format(metaData.dateFormat).parse(metaData.dateMin).getTime();
      var timeMax = d3.time.format(metaData.dateFormat).parse(metaData.dateMax).getTime();

      var scalesTime = d3.time.scale()
      .range([0, width])
      .domain([d3.time.format(metaData.dateFormat).parse(metaData.dateFrom), d3.time.format(metaData.dateFormat).parse(metaData.dateTo)]);
      var scalesValue = d3.scale.linear()
      .range([height, 0])
      .domain([metaData.valueMin, metaData.valueMax]);

      var xAxis = d3.svg.axis()
      .scale(scalesTime)
      .orient("bottom")
      .tickPadding(6)
      .tickSize(height);

      var yAxis = d3.svg.axis()
      .scale(scalesValue)
      .orient("left")
      .tickPadding(3)
      .tickSize(width);

      ////////////////

      function loadDataAndRedraw(stateData) {
      
          function collectQueries() {
            var currentKeyPath = currentPath.getPath();
            var queries = new Array();
            for (var i = 0; i < metaData.queries.length; i++) {
              if (isSerieVisible(metaData.queries[i].queryDetails.isVisible, currentKeyPath))
                queries.push(metaData.queries[i]);
            }
            return queries;
          }

          function updateGraph() {

              var timeOfBarChart = d3.time.format(metaData.dateFormat).parse(metaData.legend.dateOfBarChart).getTime();
              currentLegendData = getSeriesForLegend(timeOfBarChart);
              
              var sameKeyPaths = (stateManager.previousStateData != null) 
                    && (stateData.chartPath == stateManager.previousStateData.chartPath)
                    && (stateData.keyPath == stateManager.previousStateData.keyPath);
              
              var instantRedraw = forceFullRedraw ? false : sameKeyPaths;
              redraw(instantRedraw, stateData.isZoom);
              forceFullRedraw = false;
              
              zoomBehavior.zoomTo(scalesTime.domain());
              stateManager.previousStateData = stateData;

              if (zoomTimer)
                  clearTimeout(zoomTimer);
              zoomTimer = null;
          }

          function queryAndDraw(query) {

              /*
              var url = "server?table="+query.queryDetails.tableName
                            +"&dateKey="+query.queryDetails.dateKey
                            +"&serieKey="+query.queryDetails.serieKey
                            +"&valueKey="+query.valueKey
                            +"&from="+dateFrom
                            +"&to="+dateTo;
              if (query.queryDetails.filter)
                url +="&filter=" + encodeURIComponent(query.queryDetails.filter);
              if (query.queryDetails.join)
                url +="&join="+ encodeURIComponent(query.queryDetails.join);                     
              */
              
              url = query.url;
              
              if (appSettings.ie9)
                url = url.replace("http://defacto.ceu.hu/", "");
                
              console.log("AJAX Query: " + url);
              d3.json(url, function (error,data) {

                if (error)
                  alert("Query failed: "+  query.url);
                  if (error) return console.log("QUERY FAILED: " + error);
                else {

                  //loading data
                  var currentKeyPath = currentPath.getPath();
                  var serieCounter = 0;
                  var table = query.queryDetails.tableName === undefined ? data : data[query.queryDetails.tableName];
                  var processedSeries = new Object();
                  for (var i = 0; i < table.length; i++) {
                      var ID = table[i][query.queryDetails.serieKey];
                      var key = table[i][query.queryDetails.serieKey]; 
                      if (!series[key]) {
                          series[key] = new Array();
                          series[key].ID = ID;
                          series[key].name = _T (ID);
                          series[key].keyPath = currentKeyPath;
                          series[key].onClick = query.queryDetails.onClick;
                          series[key].color = colorFunctions[query.queryDetails.color] ? colorFunctions[query.queryDetails.color](serieCounter) : query.queryDetails.color;
                          series[key].thickness = (typeof (query.queryDetails.thickness) == "function") ? query.queryDetails.thickness(key) : query.queryDetails.thickness;
                          series[key].isVisible = query.queryDetails.isVisible;
                          series[key].parentSerie = currentPath.getLastKey();
                          
                          console.log("Serie added:" + key +"(" + serieCounter +")");
                          serieCounter ++;
                      }

                      var date = d3.time.format(metaData.dateFormat).parse(table[i][query.queryDetails.dateKey === undefined ? "date" : query.queryDetails.dateKey]).getTime();
                      //var value = table[i][query.valueKey];
                      var value = query.valueKey === undefined ? +table[i].values : +table[i][query.valueKey];
                      var defined = table[i].defined === undefined ? 1 : table[i].defined;
                      
                      if (value > metaData.valueMax)
                        metaData.valueMax = value;
                      if (value < metaData.valueMin)
                        metaData.valueMin = value;
                        
                      
                      var foundExisting = false;
                      for (var d = 0; d < series[key].length; d++)
                          if (series[key][d].date == date) {
                              series[key][d].value = value;
                              series[key][d].defined = defined;
                              foundExisting = true;
                              break;
                          }
                      if (!foundExisting)
                          series[key].push({ "date": date, "value": value, "defined": defined });

                      processedSeries[key] = true;
                  }

                  //adding path 
                  var lastKey = currentPath.getLastKey();  //last key: animate from this key
                  if (lastKey && !series[lastKey])
                      lastKey = false;  //not loaded? starting the app on a higher path level
                  for (s in processedSeries) {
                      series[s].sort(function (a, b) { return a.date - b.date; });
                      if (!series[s].path) {

                          series[s].path = clippedArea.append("svg:path")
                                  .style("stroke-width", series[s].thickness)
                                  .style("fill", "none")
                                  .style("stroke", lastKey ? series[lastKey].color : appSettings.chartBackgroundColor);
                      }
                  }
                }
                
                if (numOfQueriesToPerform > 1)
                    numOfQueriesToPerform--;
                else
                    updateGraph();

              });
          }

          ////////////////////////////////////////////////////////////////

          zoomTimer = false;
          
          if (stateData.keyPath === undefined)
            stateData.keyPath = "";
          if (stateData.isZoom === undefined)
            stateData.isZoom = false;
          if (stateData.timeFrom === undefined)
            stateData.timeFrom = d3.time.format(metaData.dateFormat).parse(metaData.dateFrom).getTime();
          if (stateData.timeTo === undefined)
            stateData.timeTo = d3.time.format(metaData.dateFormat).parse(metaData.dateTo).getTime();
            
          var currentKeyPath = currentPath.getPath();
 
          if (stateData.keyPath != currentKeyPath)               
              currentPath.setPath(stateData.keyPath);

          scalesTime.domain([new Date(stateData.timeFrom), new Date(stateData.timeTo)]);
              
          var from = stateData.timeFrom;
          var to   = stateData.timeTo;
          
          var expand = (to - from) * appSettings.preloadInvisibleArea; 

          var intervalToLoad = keyPathIntervals.add(currentPath.getPath(),
            Math.max (timeMin, from - expand),
            Math.min (timeMax, to + expand));

          if (intervalToLoad !== false) {
              var dateFrom = d3.time.format(metaData.dateFormat)(new Date(intervalToLoad[0]));
              var dateTo = d3.time.format(metaData.dateFormat)(new Date(intervalToLoad[1]));
              var queriesToPerform = collectQueries();
              var numOfQueriesToPerform = queriesToPerform.length;
              for (q = 0; q < queriesToPerform.length; q++) {
                  queryAndDraw(queriesToPerform[q], dateFrom, dateTo);
              }
          } else {
              console.log("AJAX Query: SKIPPED (no missing data)");
              updateGraph();
          }
      }

      function computeVisiblePart(fullSerie, computeMinAndMax) {
          var domain = scalesTime.domain();
          var d0 = domain[0].getTime();
          var d1 = domain[1].getTime();
          fullSerie.visiblePart = new Array();
          var lastIndex = fullSerie.length - 1;
          var isFullSerieVisible = isSerieVisible(fullSerie.isVisible,currentPath.getPath());
          for (var i = 0; i <= lastIndex; i++) {
              if (fullSerie[(i<lastIndex) ? (i+1) : i].date >= d0 && fullSerie[ (i>0) ? (i-1) : i].date <= d1) {
                fullSerie.visiblePart.push(fullSerie[i]);
                if (computeMinAndMax && isFullSerieVisible && fullSerie[i].defined) {
                  var v = fullSerie[i].value;
                  if (currentMinValue === false || v < currentMinValue)
                    currentMinValue = v;
                  if (currentMaxValue === false || v > currentMaxValue)
                    currentMaxValue = v;
                }
              }
          }
      } 
      
      function redraw(instant, isZoomState) {

          svgTooltipDot.style("display", "none");
          svgTooltipGroup.style("display", "none");

          var doCheckMinAndMaxValues = !instant || isZoomState;
          if (doCheckMinAndMaxValues) {
            currentMinValue = false;
            currentMaxValue = false;
          }
          for (s in series)
            computeVisiblePart(series[s], doCheckMinAndMaxValues);
          if (doCheckMinAndMaxValues) {
            console.log("VISIBLE AREA: Min:" + currentMinValue + " Max:" + currentMaxValue);
            var currentValueMin = scalesValue.domain()[0];
            var currentValueMax = scalesValue.domain()[1];
            
            var valueRange = metaData.valueMax - metaData.valueMin;

            var newValueMin = adaptiveYAxisFunctions[metaData.valueAxis.minValue]( currentMinValue , currentValueMin, valueRange);
            var newValueMax = adaptiveYAxisFunctions[metaData.valueAxis.maxValue]( currentMaxValue , currentValueMax, valueRange);
  
            if ( currentValueMin != newValueMin || currentValueMax != newValueMax) {
              valueScaleAnimator.start(currentValueMin, currentValueMax, newValueMin, newValueMax);
            }
          }
  
          if (instant) {
              for (s in series)
                  series[s].path.attr("d", line(series[s].visiblePart));
          }
          else {
              setTimeout(function () {
                  updateMouse();
              }, appSettings.transitionSpeed*.6);

              var currentKeyPath = currentPath.getPath();
              console.log("REDRAW:["+currentKeyPath+"]");
 
              for (s in series) {
                  
                  var newVisibleStatus = isSerieVisible(series[s].isVisible,currentKeyPath);
                  var oldVisibleStatus = series[s].visible;
                  //var animationTarget = series[s].parentSerie ? series[series[s].parentSerie] :  series[s];
                   
                  if (!oldVisibleStatus && newVisibleStatus) {
                  
                      
                      console.log("SHOWING:"+s);
                      series[s].path /*.classed("clicked", false)*/
                        .attr("stroke-dasharray", "none")
                        //.attr("d", line(animationTarget.visiblePart))
                        .style("opacity", 0)
                        .attr("d", line(series[s].visiblePart))
                         .transition().duration(appSettings.transitionSpeed)
                        //.attr("d", line(series[s].visiblePart))
                        .style("stroke", series[s].color)
                        .style("opacity", 1);
                        
                        
                      series[s].lastLegendPosition = 0;
                      series[s].legendGroup = svgLegend.append("g")
                        .attr("transform", "translate(0,0)")
                        .style("opacity", 0); 
                      series[s].legendText = series[s].legendGroup.append("text")
                        .attr("transform", "translate(0,0)")
                        .attr("font-size", "8pt")
                        .text(series[s].name)
                        .style("font-weight", /*series[s].thickness > 2 ? "bold" :*/ "normal" );
                      series[s].legendValue = series[s].legendGroup.append("text")
                        .attr("transform", "translate(0,22)")
                        .attr("font-size", "8pt")
                        .text("")
                        .style("text-anchor", "end")
                        .style("font-weight", /*series[s].thickness > 2 ? "bold" :*/ "normal" );
                      series[s].legendLine = series[s].legendGroup.append("line")
                        .attr("y1",9)     
                        .attr("y2",9)
                        .style("stroke-width", 4);
                      series[s].legendLineFix = series[s].legendGroup.append("line")
                        .attr("x2", appSettings.legendWidth)
                        .attr("y1", 7)
                        .attr("y2", 7)
                        .style("stroke-width", 1);
                      //series[s].legendDot = series[s].legendGroup.append("circle")
                      //  .attr("r", 4)
                      //  .attr("cy", 7 - 1);
                  }
                  /*else if (levelIndex < currentLevelIndex)
                      series[s].path.transition()
                      .duration(appSettings.transitionSpeed)
                      .attr("d", line(series[s].visiblePart))
                      .style("stroke", appSettings.lineOnPreviousLevelColor);*/
                  else if (!newVisibleStatus && oldVisibleStatus) {
                  
                      var seriePath = new KeyPath(series[s].keyPath);
                      console.log("HIDING:"+s);
                      
                      series[s].path
                      .transition().duration(appSettings.transitionSpeed)
                      //.attr("d", line(animationTarget.visiblePart))
                      .style("opacity", 0);
                           
                      series[s].legendGroup
                        .transition().duration(appSettings.transitionSpeed / 2)
                        .style("opacity", 0)
                        .remove();
                      }
                  
                  series[s].visible = newVisibleStatus;
              }
          }

          if (metaData.shadedIntervals) {
            for (si = 0; si < metaData.shadedIntervals.length; si++) {
                var timeFrom = d3.time.format(metaData.dateFormat).parse(metaData.shadedIntervals[si].dateFrom);
                var timeTo = d3.time.format(metaData.dateFormat).parse(metaData.shadedIntervals[si].dateTo);
                svgShadedIntervals[si]
                  .attr("x", (scalesTime(timeFrom)) + "px")
                  .attr("width", (scalesTime(timeTo) - scalesTime(timeFrom)) + "px");
            }
          }
          if (true) {//metaData.showZerolIne 
             var y = (scalesValue(0))  + "px";
             svgZeroLine.attr("y1", y).attr("y2", y).style("display","block");
          }
          
          var timeDomain = scalesTime.domain();
          if (timeDomain[0] < timeMin)
            svgOverEndRectLeft
                .style("display","block")
                .attr("x", "0px")
                .attr("width", scalesTime(timeMin) + "px");
          else
            svgOverEndRectLeft.style("display","none");
                           
          if (timeDomain[1] > timeMax) {
            var max = scalesTime(timeMax);
            svgOverEndRectRight
                .style("display","block")
                .attr("x", max+"px")
                .attr("width", (width-max) + "px");
          } else
            svgOverEndRectRight.style("display","none");
          
          //if (instant) {
              svgXaxis.call(xAxis);
              svgYaxis.call(yAxis);
          //}
          //else {
          //    svgXaxis.transition().duration(appSettings.transitionSpeed).call(xAxis);
          //    svgYaxis.transition().duration(appSettings.transitionSpeed).call(yAxis);

              //svgTitle.text(currentLevel.title);
              //chartDescription.text(currentLevel.description);
              
          //}
          

      }
      
      function getSeriesForLegend(time) {
        var seriesForLegend = new Array();
        var currentKeyPath = currentPath.getPath();
        
        for (s in series) {
          if (isSerieVisible(series[s].isVisible, currentKeyPath)) {

              var pos = -1;
              for (var i = 0; i < series[s].length; i++) {
                  if (time <= series[s][i].date) {
                      pos = i - 1;
                      break;
                  }
              }
              if (pos >= 0 && series[s][pos].defined && series[s][pos+1].defined) {
                  var f = (time - series[s][pos].date) / (series[s][pos + 1].date - series[s][pos].date);
                  var v = series[s][pos].value * (1 - f) + series[s][pos + 1].value * f;

                  seriesForLegend.push({ serie: s, value : v });
                                        
              }
          }
        }
        return seriesForLegend;
      }

      //////////////////////////////////
      //
      // Event handling
      //
      //////////////////////////////////

      function getNearestSerie(tooltipInfo, currentValues) {

          //out of the graph area
          if (lastMouseX < appSettings.margin || lastMouseX >= totalWidth - appSettings.margin 
             || lastMouseY < appSettings.margin+appSettings.descriptionZoneHeight || lastMouseY >= totalHeight - appSettings.margin)
              return false;
          
          //legend area
          if (lastMouseX >= totalWidth - appSettings.margin - appSettings.legendWidth) {
                         
              var legenRelativeYCoord = lastMouseY - appSettings.margin - appSettings.descriptionZoneHeight;
              var n = Math.floor(legenRelativeYCoord / appSettings.legendItemOffset);
              if (n>= 0 && n<currentLegendData.length )
                return currentLegendData[n].serie;
              else
                return false;
          }

          //graph area
          var currentKeyPath = currentPath.getPath();
          var currentTime = scalesTime.invert(lastMouseX - appSettings.margin).getTime();
          var currentValue = scalesValue.invert(lastMouseY - appSettings.margin - appSettings.descriptionZoneHeight);

          var lowestDistance = (metaData.valueMax - metaData.valueMin) * appSettings.lineSenitiveWidth / width;
          var nearestSerie = false;

          for (s in series) {
              if (isSerieVisible(series[s].isVisible,currentKeyPath)) {

                  var pos = -1;
                  for (var i = 0; i < series[s].visiblePart.length; i++) {
                      if (currentTime < series[s].visiblePart[i].date) {
                          pos = i - 1;
                          break;
                      }
                  }
                  if (pos >= 0 && series[s].visiblePart[pos].defined && series[s].visiblePart[pos+1].defined) {
                      var f = (currentTime - series[s].visiblePart[pos].date) 
                            / (series[s].visiblePart[pos + 1].date - series[s].visiblePart[pos].date);
                      var v = series[s].visiblePart[pos].value * (1 - f) + series[s].visiblePart[pos + 1].value * f;

                      if (currentValues)
                        currentValues.push({ serie: s, value : v });
                        
                      var currentDistance = Math.abs(v - currentValue);
                      if (currentDistance < lowestDistance) {
                          lowestDistance = currentDistance;
                          nearestSerie = s;

                          if (tooltipInfo) {
                              tooltipInfo.tooltipDate = (f > 0.5) ? series[s].visiblePart[pos + 1].date : series[s].visiblePart[pos].date;
                              tooltipInfo.tooltipValue = (f > 0.5) ? series[s].visiblePart[pos + 1].value : series[s].visiblePart[pos].value;
                          }
                      }                      
                  }
              }
          }
          
          if (tooltipInfo && !tooltipInfo.tooltipDate) {
            if (metaData.shadedIntervals)
              for (si = 0; si < metaData.shadedIntervals.length; si++) {
                var timeFrom = d3.time.format(metaData.dateFormat).parse(metaData.shadedIntervals[si].dateFrom);
                var timeTo = d3.time.format(metaData.dateFormat).parse(metaData.shadedIntervals[si].dateTo);
                if (currentTime >= timeFrom && currentTime <= timeTo) {
                  tooltipInfo.tooltipShadedIntervalName = metaData.shadedIntervals[si].tooltip;
                  tooltipInfo.tooltipDate = currentTime;
                  tooltipInfo.tooltipValue = currentValue;                  
                }
              }
          }
          return nearestSerie;
      }
      var lastMouseX = -1;
      var lastMouseY = -1;

      function onMouseMove() {
          var coords = d3.mouse(svg.node());
          lastMouseX = coords[0];
          lastMouseY = coords[1];
          updateMouse();
      }
      function updateMouse( ) {
          if (zoomTimer)
              return;
          var tooltipInfo = new Object();
          var currentValues = new Array();
          var nearestSerie = getNearestSerie(tooltipInfo,currentValues);
          var currentKeyPath = currentPath.getPath();
          
          if (currentValues.length == 0)
            currentValues = currentLegendData;
          
          if (!currentValues)
            return;
          currentValues.sort(function(a,b){
            return b.value - a.value;
          });

          for (s in series)
            series[s].legendVisible = false;
            
          var currentValueMin = scalesValue.domain()[0];
          var currentValueMax = scalesValue.domain()[1];
            
          for (i = 0; i<currentValues.length; i++) {
          
              var xf = (currentValues[i].value-currentValueMin) / (currentValueMax-currentValueMin);
              var xPos = Math.min(Math.max(xf, 0), 1) * appSettings.legendWidth;
              var s = currentValues[i].serie;
              var hidden = nearestSerie && (s != nearestSerie);
              var selected = nearestSerie && (s == nearestSerie);

              
              series[s].path.style("display","block")
                .style("stroke", series[s].color)
                .style("opacity", 1)
                .style("stroke-width", selected ? series[s].thickness + 2 : series[s].thickness )
                .transition().duration(appSettings.transitionSpeed)
                  .style("opacity", hidden ? appSettings.hiddenOpacity : 1);
//                   .style("opacity", 1)
//                   .style("stroke", hidden ? appSettings.hiddenLineColor : series[s].color);

            if (series[s].legendText) {
        
              series[s].legendLine.style("display","block")
                .style("stroke", series[s].color)
                .attr("x2",xPos)
                .style("opacity", 1)
                .transition().duration(appSettings.transitionSpeed)
                   .style("opacity", hidden ? appSettings.hiddenOpacity : 1);
//                   .style("stroke", hidden ? appSettings.hiddenLineColor : series[s].color);
              series[s].legendValue.style("display","block")
                .style("fill", appSettings.legendTextColor)
                .attr("x",xPos)
                .text(d3.format(metaData.valueFormat)(currentValues[i].value))
                .style("opacity", 1)
                .transition().duration(appSettings.transitionSpeed)
                   .style("opacity", hidden ? appSettings.hiddenOpacity : 1);
//                 .style("fill", hidden ? appSettings.hiddenLineColor : appSettings.legendTextColor);
              series[s].legendLineFix.style("display","block")
                .style("stroke", series[s].color)
                .style("stroke-width", selected ? 3 : 1 )
                .style("opacity", 1)
                .transition().duration(appSettings.transitionSpeed)
                  .style("opacity", hidden ? appSettings.hiddenOpacity : 1);
//                .style("stroke", hidden ? appSettings.hiddenLineColor : series[s].color);
              //series[s].legendDot.style("display","block")
              //  .attr("cx",xPos)
              //  .style("fill", hidden ? appSettings.hiddenLineColor : series[s].color);
              series[s].legendText.style("display","block")
                .style("fill", appSettings.legendTextColor)
                .style("opacity", 1)
                .transition().duration(appSettings.transitionSpeed)
                  .style("opacity", hidden ? appSettings.hiddenOpacity : 1);
//                .style("fill", hidden ? appSettings.hiddenLineColor : appSettings.legendTextColor);
               series[s].legendVisible = true;
              
              var noLegenPosChange = (series[s].lastLegendPosition && series[s].lastLegendPosition == i+1) 
              if (!noLegenPosChange) {
              
                var yPos = appSettings.legendItemOffset * ( i + (2/3));              
                series[s].legendGroup.transition().attr("transform", "translate(0," + yPos + ")").style("opacity", 1);               
                series[s].lastLegendPosition = i+1;
              }
            }
          }
          for (s in series)
            if (isSerieVisible(series[s].isVisible,currentKeyPath) && series[s].legendVisible == false) {
              var hidden = nearestSerie && (s != nearestSerie);
              series[s].path.style("stroke", hidden ? appSettings.hiddenLineColor : series[s].color);
              if (series[s].legendText) {
                series[s].legendLine.style("display","none");
                series[s].legendValue.style("display","none");
                series[s].legendLineFix.style("display","none");
                //series[s].legendDot.style("display","none");
                series[s].legendText.style("display","none");
                series[s].lastLegendPosition = 0;
              }
            }
              

          if (nearestSerie) //brings selected line to front
              clippedArea.node().appendChild(series[nearestSerie].path.node());

          if (tooltipInfo.tooltipDate && tooltipInfo.tooltipValue) {

              var px = scalesTime(tooltipInfo.tooltipDate);
              var py = scalesValue(tooltipInfo.tooltipValue);
              
              if (tooltipInfo.tooltipShadedIntervalName) {
                svgTooltipDot.style("display", "none");
                svgTooltipGroup.attr("transform", "translate(" + px + "," + (py-20) + ")")
                  .style("display", "block");
                svgTooltipText.text(tooltipInfo.tooltipShadedIntervalName)
                  .style("text-anchor", px > width / 2 ? "end" : "start");
              }
              else if (nearestSerie) {
                    
                    svgTooltipGroup. remove(); //hogy felülre kerüljön
                    
                    svgTooltipGroup = clippedArea.append("g")
                      .attr("transform", "translate(" + px + "," + (py-20) + ")")
                      .style("display", "block");
                     svgTooltipREct = svgTooltipGroup.append("rect")
                      .attr("fill", "rgba(255, 255, 255, .85)")
                      .attr("stroke", "#dddddd")
                      .attr("x", px > width / 2 ? "-260px"  : "0px" )
                      .attr("y", py > height / 2 ? "-15px"  : "40px")
                      .attr("width", "260px")
                      .attr("height", "25px");


                     svgTooltipText = svgTooltipGroup.append("text")
                      .attr("x", px > width / 2 ? "-2px"  : "2px" )
                      .attr("y", py > height / 2 ? "0px"  : "55px")
                      .attr("font-size", "9pt")
                      .attr("fill", "#000000")
                      .text(tooltipTextFunctions[metaData.tooltipText]
                          (series[nearestSerie].name, d3.time.format(metaData.dateFormat)(new Date(tooltipInfo.tooltipDate)),
                                                                                      d3.format(metaData.valueFormat)(tooltipInfo.tooltipValue)))
                      .style("text-anchor", px > width / 2 ? "end" : "start");

              
                     svgTooltipDot.style("display", "block")
                      .attr("cx", px + "px")
                      .attr("cy", py + "px")
                      .style("stroke", series[nearestSerie].color)
                      .style("fill", series[nearestSerie].color);     
              
    
              }
              else {
                svgTooltipDot.style("display", "none");
                svgTooltipGroup.style("display", "none");
              }
          }
          else {
              svgTooltipDot.style("display", "none");
              svgTooltipGroup.style("display", "none");
          }
          var lineXPos = lastMouseX - appSettings.margin;
          var lineYPos = lastMouseY - appSettings.margin - appSettings.descriptionZoneHeight;
          if (lineXPos < 0 || lineXPos > width || lineYPos < 0 || lineYPos >= height  ) {
            svgSectionLineX.style("display", "none");
            //svgSectionLineY.style("display", "none");

            var clickablePosition = (nearestSerie ? (series[nearestSerie].onClick != 0) : false);
            svg.style("cursor", clickablePosition ? "pointer" : "default");
            
          }
          else {
            svgSectionLineX.style("display", "block").attr("x1", lineXPos).attr("x2", lineXPos+"px");
            //svgSectionLineY.style("display", "block").attr("y1", lineYPos).attr("y2", lineYPos+"px");
            
            var clickablePosition = (nearestSerie ? (series[nearestSerie].onClick != 0) : currentKeyPath != "");
            svg.style("cursor", clickablePosition ? "pointer" : "crosshair");
          
          }

      }

      function onClick() {

          var nearestSerie = getNearestSerie();
          if (nearestSerie) {

              if (series[nearestSerie].onClick > 0) {

                  //if (metaData.levels.length > currentPath.getLevelIndex() + 1) {
                      series[nearestSerie].path.attr("stroke-dasharray", "5,5"); //classed("clicked", true);
                      console.log("Clicked serie: " + nearestSerie);

                      var currentKeyPath = currentPath.getPath();
                      var newKeyPath = nearestSerie;
                      changeState({ "keyPath": newKeyPath });
                 // }
                  //else
                    //  console.log("Error: Cannot access level: " + nextLevelIndex);
              }
          } else {

              //if (currentPath.getLevelIndex() > 0) {
                  console.log("Clicked empty area: returning to the previous level.");
                  
                  //keyPathIntervals.storage[currentPath.getPath()] = undefined; //TODO

                  var newKeyPath = currentPath.clone().removeLastKey().getPath();
                  changeState({ "keyPath": newKeyPath });
              //}

          }
      }
      function onMouseOut() {
          var coords = d3.mouse(svg.node());
          if (coords[0] < 0 || coords[0] >= totalWidth || coords[1] < 0 || coords[1] >= totalHeight)
              onMouseMove();
      }

      ///// Shaded intervals ////
      
      var currentShadedIntervalScheme = "";
      function updateShadedTintervals(scheme) {
        if (metaData.shadedIntervals) 
          for (si = 0; si < metaData.shadedIntervals.length; si++) 
            svgShadedIntervals[si].style("display", metaData.shadedIntervals[si].scheme == currentShadedIntervalScheme ? "block" : "none" );
      }
          

      ///////////////////////////////
      //
      // ZOOMING
      //
      ///////////////////////////////

      var zoomBehavior = d3.behavior.zoom()
      .scaleExtent([0.25, 4])
      .on("zoom", function () {

          var currentTranslate = zoomBehavior.translate();
          var currentScale = zoomBehavior.scale();

          //var isPan = (currentScale == zoomBehavior.previousScale);

          scalesTime.domain(zoomBehavior.originalScale.range()
            .map(function (x) { return (x - currentTranslate[0]) / currentScale; })
            .map(zoomBehavior.originalScale.invert));

          redraw(true);
          zoomStart();

      });
      zoomBehavior.zoomTo = function (scaleDomain) {
          var tRange = scaleDomain.map(this.originalScale);
          var tOriginalRange = this.originalScale.range();
          var tScale = (tOriginalRange[1] - tOriginalRange[0]) / (tRange[1] - tRange[0])
          var tTranslate = tOriginalRange[0] - tRange[0] * tScale;

          this.scale(tScale);
          this.translate([tTranslate, 0]);
      };
      zoomBehavior.originalScale = scalesTime.copy();

      /////////////

      var zoomTimer = null;
      var zoomTimeout = 300;

      //var timeCorrectionPhases = 0;
      //var valueCorrectionPhases = 0;
      
      //var zoomTargetTimeMin = 0;
      //var zoomTargetTimeMax = 0;
      //var zoomTargetValueMin = 0;
      //var zoomTargetValueMax = 0;

      var valueScaleAnimator = new scaleAnimator( appSettings.transitionSpeed, function(min,max,isFinal) {
         scalesValue.domain([min,max]); 
      });
      var timeScaleAnimator = new scaleAnimator( appSettings.transitionSpeed, function(min,max,isFinal) {
         if (isFinal)
          changeState({ "timeFrom":min , "timeTo": max,  "isZoom": true }); 
         else
          scalesTime.domain([new Date(min), new Date(max)]);
      });

      d3.timer( function() {
          if (!zoomTimer) {
            var needRedraw = false;
            if (timeScaleAnimator.animate())
              needRedraw = true;
            if (valueScaleAnimator.animate())
              needRedraw = true;
            if (needRedraw)
              redraw(true);
          } else {
            timeScaleAnimator.reset();
            valueScaleAnimator.reset();
          }
          
          

          
          return false;
      });
      
      
      
      function onZoomTimer() {
          zoomTimer = null;

          var needTimecorrection = false;
          
          var originalTimeMin = scalesTime.domain()[0].getTime();
          var originalTimeMax = scalesTime.domain()[1].getTime();
          if (originalTimeMin < timeMin) {
              var otherEnd = originalTimeMax + (timeMin - originalTimeMin);
              var zoomTargetTimeMin = timeMin;
              var zoomTargetTimeMax = otherEnd > timeMax ? timeMax : otherEnd;
              needTimecorrection = true;
          }   
          else if (originalTimeMax > timeMax) {
              var otherEnd = originalTimeMin - (originalTimeMax - timeMax);
              var zoomTargetTimeMin = otherEnd < timeMin ? timeMin : otherEnd;
              var zoomTargetTimeMax = timeMax;
              needTimecorrection = true;
          }  
          
          if (needTimecorrection)
            timeScaleAnimator.start(originalTimeMin, originalTimeMax,zoomTargetTimeMin, zoomTargetTimeMax );
          else 
            changeState({ "timeFrom":zoomTargetTimeMin , "timeTo": zoomTargetTimeMax,  "isZoom": true });
      }
      function zoomStart() {
          if (zoomTimer === false)
              return;

          svgSectionLineX.style("display", "none");
          //svgSectionLineY.style("display", "none");
          if (zoomTimer)
              clearTimeout(zoomTimer);
          zoomTimer = setTimeout(function () { onZoomTimer(); }, zoomTimeout);
      }

      ///////////////////////////////
      //
      // INIT
      //
      ///////////////////////////////

      var svg = d3.select(this).append("svg:svg")
      .attr("width", totalWidth)
      .attr("height", totalHeight)
      .attr("version", 1.1)
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .on("mousemove", function () { onMouseMove(); })
      .on("click", function () { onClick(); })
 
      var chartDescription = svg.append("text")
      .attr("font-size", "10pt")
      .style("fill", appSettings.legendTextColor)
      for (var i = 0; i< metaData.description.length; i++)
        chartDescription.append("tspan")
          .attr("x", appSettings.margin)
          .attr("y", appSettings.margin + 16*i)
          .text(metaData.description[i]);
      
      var clipRect = svg.append("svg:defs").append("svg:clipPath")
        .attr("id", "clipRect")
        .append("svg:rect")
        .attr("width", width + "px")
        .attr("height", height + "px")
        .attr("x", "0px")
        .attr("y", "0px");
      
      
      var line = d3.svg.line()
      .x(function (dataRecord) { return scalesTime(dataRecord["date"]); })
      .y(function (dataRecord) { return scalesValue(dataRecord["value"]); })
      .defined(function (dataRecord) { return dataRecord["defined"] > 0; });


      ////////////////

      svg.append("rect")
      //.attr("class", "chartBackground")
      .attr("fill", "#F9F9F9")
      .attr("width", width + "px")
      .attr("height", height + "px")
      .attr("x", appSettings.margin + "px")
      .attr("y", (appSettings.margin+appSettings.descriptionZoneHeight) + "px");

      var svgLegend = svg.append("g")
      .attr("transform", "translate(" + (appSettings.margin * 2 + width) + "," + (appSettings.margin+appSettings.descriptionZoneHeight) + ")");

      //var svgTitle = svg.append("text")
     // .attr("transform", "translate(" + (appSettings.margin) + ",25)")
      //.classed("chartTitle", true)
      //.text("");

      svg.call(zoomBehavior);

      var svgXaxis = svg.append("g")
      .attr("stroke","#E1E1E1")
      .attr("stroke-width","1px")
      .attr("shape-rendering","crispEdges")
      .attr("font-size","9pt")
      .attr("fill","none")
      .attr("transform", "translate(" + appSettings.margin + "," + (appSettings.margin+appSettings.descriptionZoneHeight) + ")");

      var svgYaxis = svg.append("g")
      .attr("stroke","#E1E1E1")
      .attr("stroke-width","1px")
      .attr("shape-rendering","crispEdges")
      .attr("font-size","9pt")
      .attr("fill","none")
      .attr("transform", "translate(" + (width + appSettings.margin) + "," + (appSettings.margin+appSettings.descriptionZoneHeight) + ")");

      var clippedArea = svg.append("g")
        .attr("transform", "translate(" + appSettings.margin + "," + (appSettings.margin+appSettings.descriptionZoneHeight) + ")")
        .attr("clip-path", "url(#clipRect)");


      var svgShadedIntervals = new Array();
      if (metaData.shadedIntervals)
        for (si = 0; si < metaData.shadedIntervals.length; si++) {
            svgShadedIntervals[si] = clippedArea.append("rect")
            //.classed("shadedIntervals", true)
            .style("fill", metaData.shadedIntervals[si].color)
            .style("display", "none")
            .style("opacity", "0.5")
            .attr("y", "0px")
            .attr("height", height + "px");
        }

      var svgZeroLine = clippedArea.append("line")
        .attr("x1", 0).attr("x2", width)
        .attr("y1", 0).attr("y2", height)
        .style("stroke", "#aaaaaa" )
        .style("stroke-width", 1 )
        .style("display","none");
 
      var svgOverEndRectLeft = clippedArea.append("rect")
        .attr("fill", "#818181")
        //.classed("overEndRect", true)
        .attr("y", "0px")
        .attr("height", height + "px");
      var svgOverEndRectRight = clippedArea.append("rect")
        .attr("fill", "#818181")
        //.classed("overEndRect", true)
        .attr("y", "0px")
        .attr("height", height + "px");

      var svgTooltipDot = clippedArea.append("circle")
      //  .classed("tooltipDot", true)
        .attr("r", 4)
        .style("display", "none");


      var svgTooltipGroup = clippedArea.append("g")
      var svgTooltipREct = svgTooltipGroup.append("rect")
        .attr("fill", "#ffffff")
        .attr("stroke", "#dddddd")
        .attr("x", "0px")
        .attr("y", "-18px")
        .attr("width", "300px")
        .attr("height", "20px");

      var svgTooltipText = svgTooltipGroup.append("text")
      //  .classed("tooltipText", true);
        .attr("font-size", "9pt")
        .attr("fill", "#818181");
        
      //var svgTooltipText2 = svgTooltipGroup.append("text")
      //  .classed("tooltipText", true);
      //  .attr("font-size", "9pt")
      //  .attr("fill", "#818181");

        
      var svgSectionLineX = clippedArea.append("line")
        .attr("x1", width).attr("x2", width)
        .attr("y1", 0).attr("y2", height)
        .style("stroke", "#aaaaff" )
//        .style("stroke-dasharray", "10, 5, 1, 5" )
       .style("stroke-width", 1 );
 //     var svgSectionLineY = clippedArea.append("line")
 //       .attr("x1", 0).attr("x2", width)
 //       .attr("y1", height).attr("y2", height)
//        .style("stroke", "#aaaaff" )
//        .style("stroke-dasharray", "10, 5, 1, 5" )
//        .style("stroke-width", 1 );


      ///////////////////////////

      xAxis.scale(scalesTime)
      .ticks(metaData.timeAxis.tickCount)
      .tickFormat(tickFormatFunctions[metaData.timeAxis.tickFormat])
      .tickSubdivide(metaData.timeAxis.subdivide);
      yAxis.scale(scalesValue)
      .ticks(metaData.valueAxis.tickCount)
      .tickFormat(tickFormatFunctions[metaData.valueAxis.tickFormat])
      .tickSubdivide(metaData.valueAxis.subdivide);
      
      ///////////////////////////
      
      /*d3.select("#downloadSVGlink")
      .attr("title", "Download chart as SVG file")
      .on("click", function () { 
          
            var svgContent = svg.node().parentNode.innerHTML;
            directPost('download.php',  { "svg": svgContent } ); //directPost implemented in utils.js ....

                    
      });*/
      
      d3.select("#shareLink")
      .attr("title", "Megosztás")
      .on("mouseover", function () { 
          d3.select("#chartShareArea").style("display", "block");
          d3.select("#shareButton").classed("shareButton_normal", false);
          d3.select("#shareButton").classed("shareButton_hover", true);
      })
      .on("mouseout", function () { 
          d3.select("#chartShareArea").style("display", "none");    
          d3.select("#shareButton").classed("shareButton_normal", true);
          d3.select("#shareButton").classed("shareButton_hover", false);
      });
      
      d3.select("#aboutLink")
      .attr("title", "A Defactóról")
      .on("mouseover", function () { 
          d3.select("#chartAboutArea").style("display", "block");
          d3.select("#aboutButton").classed("shareButton_normal", false);
          d3.select("#aboutButton").classed("shareButton_hover", true);
      })
      .on("mouseout", function () { 
          d3.select("#chartAboutArea").style("display", "none");    
          d3.select("#aboutButton").classed("shareButton_normal", true);
          d3.select("#aboutButton").classed("shareButton_hover", false);
      });
      
      /*d3.select("#shareFacebookLink")
      .attr("title", "Share on Facebook")
      .on("mouseover", function () { 
          d3.select("#shareFacebookArea").style("display", "block");
      })
      .on("mouseout", function () { 
          d3.select("#shareFacebookArea").style("display", "none");         
      });

      d3.select("#shareGooglePlusLink")
      .attr("title", "Share on Google+")
      .on("mouseover", function () { 
          d3.select("#shareGooglePlusArea").style("display", "block");
      })
      .on("mouseout", function () { 
          d3.select("#shareGooglePlusArea").style("display", "none");         
      });
      
     d3.select("#shareTwitterLink")
      .attr("title", "Share on Twitter")
      .on("mouseover", function () { 
          d3.select("#shareTwitterArea").style("display", "block");
      })
      .on("mouseout", function () { 
          d3.select("#shareTwitterArea").style("display", "none");         
      });
      
      d3.select("#shareTumblrLink")
      .attr("title", "Share on Tumblr")
      .on("mouseover", function () { 
          d3.select("#shareTumblrArea").style("display", "block");
      })
      .on("mouseout", function () { 
          d3.select("#shareTumblrArea").style("display", "none");         
      });*/
      
      d3.select("#detailsButton")
      .on("click", function () { 
          d3.select("#detailsPanel").style("display", "block");
          d3.select("#detailsButton").style("display", "none");
      })
      
      d3.select("#detailsText")
      .text(metaData.details);

      d3.select("#detailsPanel")
      .on("click", function () { 
          d3.select("#detailsButton").style("display", "block");
          d3.select("#detailsPanel").style("display", "none");
      })
      ///////////////////////////
      
      /*d3.select("#aboutUsButton")
      .on("click", function () { 
          d3.select("#aboutUsPanel").style("display", "block");
          d3.select("#aboutUsButton").style("display", "none");
      })
      
      d3.select("#aboutUsPanel")
      .on("click", function () { 
          d3.select("#aboutUsButton").style("display", "block");
          d3.select("#aboutUsPanel").style("display", "none");
      })*/
      ///////////////////////////
      stateManager.refreshChartFunction = loadDataAndRedraw;

      ///////////////////////////
   
      completeStateData(stateData);
      loadDataAndRedraw(stateData);             
  });
}
