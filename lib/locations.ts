export const LOCATION_DATA:Record<string,Record<string,string[]>>={
  India:{
    "Andhra Pradesh":["Visakhapatnam","Vijayawada","Tirupati"],"Assam":["Guwahati"],"Bihar":["Patna"],
    "Chandigarh":["Chandigarh"],"Chhattisgarh":["Raipur"],"Delhi":["New Delhi"],"Goa":["Panaji"],
    "Gujarat":["Ahmedabad","Gandhinagar","Surat","Vadodara"],"Haryana":["Gurugram","Faridabad","Panipat"],
    "Himachal Pradesh":["Shimla"],"Jharkhand":["Ranchi","Jamshedpur"],"Jammu and Kashmir":["Srinagar","Jammu"],
    "Karnataka":["Bengaluru","Mysuru"],"Kerala":["Kochi","Thiruvananthapuram"],"Madhya Pradesh":["Indore","Bhopal"],
    "Maharashtra":["Mumbai","Pune","Nagpur","Nashik"],"Manipur":["Imphal"],"Meghalaya":["Shillong"],
    "Odisha":["Bhubaneswar"],"Punjab":["Chandigarh","Ludhiana","Amritsar"],"Rajasthan":["Jaipur","Udaipur"],
    "Tamil Nadu":["Chennai","Coimbatore"],"Telangana":["Hyderabad"],"Uttar Pradesh":["Noida","Greater Noida","Gurugram","Lucknow","Kanpur","Agra","Varanasi"],
    "Uttarakhand":["Dehradun","Haridwar"],"West Bengal":["Kolkata"]
  },
  "United States":{"California":["San Francisco","Los Angeles","San Diego"],"New York":["New York City"],"Texas":["Austin","Dallas","Houston"],"Washington":["Seattle"],"Illinois":["Chicago"],"Massachusetts":["Boston"],"Florida":["Miami"]},
  "United Kingdom":{"England":["London","Manchester","Birmingham"],"Scotland":["Edinburgh","Glasgow"],"Wales":["Cardiff"]},
  Canada:{Ontario:["Toronto","Ottawa"],"British Columbia":["Vancouver"],Quebec:["Montreal"],Alberta:["Calgary","Edmonton"]},
  Australia:{"New South Wales":["Sydney"],Victoria:["Melbourne"],Queensland:["Brisbane"],"Western Australia":["Perth"]},
  UAE:{Dubai:["Dubai"],"Abu Dhabi":["Abu Dhabi"]},Singapore:{Singapore:["Singapore"]},
  Germany:{Berlin:["Berlin"],Bavaria:["Munich"],"Hesse":["Frankfurt"]}
};
export const COUNTRIES=Object.keys(LOCATION_DATA);
export function statesFor(country:string){return Object.keys(LOCATION_DATA[country]??{});}
export function citiesFor(country:string,state:string){return LOCATION_DATA[country]?.[state]??[];}