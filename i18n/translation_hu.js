var translations = {
  "CZ" : "Csehország",
  "DE"	: "Németország",
  "HU"	: "Magyarország",
  "AU"	:"Ausztria",
  "PL" : "Lengyelország",
  "SK" : "Szlovákia",

  "EU15" : "Európai Unió (15)",
  "V3" : "Visegrádi országok (3)",
  "EA17" : "EURO övezet (17)",
  "EA" : "EURO övezet"
}

function _T(text) {
  if (translations[text] === undefined)
    console.log ("Missing translation: "+text);
  return translations[text] ? translations[text] : text;
}