export interface AirportOption {
  city: string;
  airport: string;
  iata: string;
  icao: string;
  country: string;
  lat: number;
  lng: number;
}

interface AirportRecord extends AirportOption {
  aliases?: string[];
}

const AIRPORTS: AirportRecord[] = [
  // ── Iran ──────────────────────────────────────────────────────────────────
  { iata:'IKA', icao:'OIIE', airport:'Imam Khomeini International Airport', city:'Tehran', country:'Iran', lat:35.4161, lng:51.1522, aliases:['ikia','tehran international','emam khomeini'] },
  { iata:'THR', icao:'OIII', airport:'Mehrabad International Airport',       city:'Tehran', country:'Iran', lat:35.6892, lng:51.3144, aliases:['mehrabad','tehran mehrabad'] },
  { iata:'SYZ', icao:'OISS', airport:'Shiraz International Airport',         city:'Shiraz', country:'Iran', lat:29.5392, lng:52.5898 },
  { iata:'TBZ', icao:'OITT', airport:'Tabriz International Airport',         city:'Tabriz', country:'Iran', lat:38.1339, lng:46.2350 },
  { iata:'MHD', icao:'OIMM', airport:'Mashhad International Airport',        city:'Mashhad', country:'Iran', lat:36.2352, lng:59.6410, aliases:['shahid hasheminejad','mashad'] },
  { iata:'IFN', icao:'OIFM', airport:'Isfahan International Airport',        city:'Isfahan', country:'Iran', lat:32.7508, lng:51.8613, aliases:['esfahan','isfahan'] },
  { iata:'AWZ', icao:'OIAW', airport:'Ahvaz International Airport',          city:'Ahvaz', country:'Iran', lat:31.3374, lng:48.7620, aliases:['ahwaz'] },
  { iata:'BND', icao:'OIKB', airport:'Bandar Abbas International Airport',   city:'Bandar Abbas', country:'Iran', lat:27.2183, lng:56.3778 },
  { iata:'KER', icao:'OIKK', airport:'Kerman Airport',                       city:'Kerman', country:'Iran', lat:30.2744, lng:56.9511 },
  { iata:'ABD', icao:'OIAA', airport:'Abadan International Airport',         city:'Abadan', country:'Iran', lat:30.3711, lng:48.2283 },
  { iata:'RAS', icao:'OIGG', airport:'Rasht Airport',                        city:'Rasht', country:'Iran', lat:37.3233, lng:49.6178 },
  { iata:'KHD', icao:'OICK', airport:'Khorramabad Airport',                  city:'Khorramabad', country:'Iran', lat:33.4354, lng:48.2822 },
  { iata:'OMH', icao:'OITR', airport:'Urmia Airport',                        city:'Urmia', country:'Iran', lat:37.6681, lng:45.0687, aliases:['urumiyeh','orumiyeh'] },
  { iata:'ZAH', icao:'OIZH', airport:'Zahedan International Airport',        city:'Zahedan', country:'Iran', lat:29.4757, lng:60.9062 },
  { iata:'AJK', icao:'OIAS', airport:'Arak Airport',                         city:'Arak', country:'Iran', lat:34.1381, lng:49.8474 },
  { iata:'AEU', icao:'OIBA', airport:'Abumusa Island Airport',               city:'Bushehr', country:'Iran', lat:28.9448, lng:50.8346 },

  // ── Turkey ────────────────────────────────────────────────────────────────
  { iata:'IST', icao:'LTFM', airport:'Istanbul Airport',            city:'Istanbul', country:'Turkey', lat:41.2608, lng:28.7419, aliases:['stambul','istambul','konstantinopol','istanbul new'] },
  { iata:'SAW', icao:'LTFJ', airport:'Sabiha Gökçen Airport',       city:'Istanbul', country:'Turkey', lat:40.8985, lng:29.3092, aliases:['sabiha','gokcen','stambul','istanbul sabiha'] },
  { iata:'AYT', icao:'LTAI', airport:'Antalya Airport',             city:'Antalya', country:'Turkey', lat:36.8987, lng:30.8003 },
  { iata:'ADB', icao:'LTBJ', airport:'Adnan Menderes Airport',      city:'Izmir', country:'Turkey', lat:38.2924, lng:27.1570, aliases:['smyrna'] },
  { iata:'ESB', icao:'LTAC', airport:'Esenboga Airport',            city:'Ankara', country:'Turkey', lat:40.1281, lng:32.9951 },
  { iata:'TZX', icao:'LTCG', airport:'Trabzon Airport',             city:'Trabzon', country:'Turkey', lat:40.9950, lng:39.7897 },

  // ── UAE ───────────────────────────────────────────────────────────────────
  { iata:'DXB', icao:'OMDB', airport:'Dubai International Airport', city:'Dubai', country:'UAE', lat:25.2528, lng:55.3644, aliases:['emirates','dubai intl'] },
  { iata:'DWC', icao:'OMDW', airport:'Al Maktoum International Airport', city:'Dubai', country:'UAE', lat:24.8963, lng:55.1614, aliases:['dubai world central','jebel ali'] },
  { iata:'AUH', icao:'OMAA', airport:'Abu Dhabi International Airport', city:'Abu Dhabi', country:'UAE', lat:24.4330, lng:54.6511 },
  { iata:'SHJ', icao:'OMSJ', airport:'Sharjah International Airport',   city:'Sharjah', country:'UAE', lat:25.3286, lng:55.5172 },

  // ── Canada ────────────────────────────────────────────────────────────────
  { iata:'YYZ', icao:'CYYZ', airport:'Toronto Pearson International Airport', city:'Toronto', country:'Canada', lat:43.6777, lng:-79.6248 },
  { iata:'YTZ', icao:'CYVZ', airport:'Billy Bishop Toronto City Airport',     city:'Toronto', country:'Canada', lat:43.6275, lng:-79.3962, aliases:['toronto city','island airport'] },
  { iata:'YVR', icao:'CYVR', airport:'Vancouver International Airport',       city:'Vancouver', country:'Canada', lat:49.1967, lng:-123.1815 },
  { iata:'YUL', icao:'CYUL', airport:'Montreal-Trudeau International Airport',city:'Montreal', country:'Canada', lat:45.4706, lng:-73.7408 },
  { iata:'YEG', icao:'CYEG', airport:'Edmonton International Airport',        city:'Edmonton', country:'Canada', lat:53.3097, lng:-113.5797 },
  { iata:'YYC', icao:'CYYC', airport:'Calgary International Airport',         city:'Calgary', country:'Canada', lat:51.1215, lng:-114.0127 },
  { iata:'YOW', icao:'CYOW', airport:'Ottawa Macdonald-Cartier International Airport', city:'Ottawa', country:'Canada', lat:45.3225, lng:-75.6692 },
  { iata:'YHZ', icao:'CYHZ', airport:'Halifax Stanfield International Airport',city:'Halifax', country:'Canada', lat:44.8808, lng:-63.5086 },

  // ── United Kingdom ────────────────────────────────────────────────────────
  { iata:'LHR', icao:'EGLL', airport:'London Heathrow Airport',  city:'London', country:'United Kingdom', lat:51.4700, lng:-0.4543, aliases:['heathrow'] },
  { iata:'LGW', icao:'EGKK', airport:'London Gatwick Airport',   city:'London', country:'United Kingdom', lat:51.1537, lng:-0.1821, aliases:['gatwick'] },
  { iata:'STN', icao:'EGSS', airport:'London Stansted Airport',  city:'London', country:'United Kingdom', lat:51.8860, lng:0.2389,  aliases:['stansted'] },
  { iata:'LCY', icao:'EGLC', airport:'London City Airport',      city:'London', country:'United Kingdom', lat:51.5053, lng:0.0553 },
  { iata:'MAN', icao:'EGCC', airport:'Manchester Airport',        city:'Manchester', country:'United Kingdom', lat:53.3537, lng:-2.2750 },
  { iata:'BHX', icao:'EGBB', airport:'Birmingham Airport',        city:'Birmingham', country:'United Kingdom', lat:52.4539, lng:-1.7480 },
  { iata:'EDI', icao:'EGPH', airport:'Edinburgh Airport',         city:'Edinburgh', country:'United Kingdom', lat:55.9500, lng:-3.3725 },
  { iata:'GLA', icao:'EGPF', airport:'Glasgow Airport',           city:'Glasgow', country:'United Kingdom', lat:55.8719, lng:-4.4331 },

  // ── Germany ───────────────────────────────────────────────────────────────
  { iata:'FRA', icao:'EDDF', airport:'Frankfurt Airport',          city:'Frankfurt', country:'Germany', lat:50.0379, lng:8.5622 },
  { iata:'MUC', icao:'EDDM', airport:'Munich Airport',             city:'Munich', country:'Germany', lat:48.3537, lng:11.7750 },
  { iata:'BER', icao:'EDDB', airport:'Berlin Brandenburg Airport', city:'Berlin', country:'Germany', lat:52.3667, lng:13.5033 },
  { iata:'DUS', icao:'EDDL', airport:'Dusseldorf Airport',         city:'Düsseldorf', country:'Germany', lat:51.2895, lng:6.7668, aliases:['dusseldorf','düsseldorf'] },
  { iata:'HAM', icao:'EDDH', airport:'Hamburg Airport',            city:'Hamburg', country:'Germany', lat:53.6304, lng:9.9882 },
  { iata:'CGN', icao:'EDDK', airport:'Cologne Bonn Airport',       city:'Cologne', country:'Germany', lat:50.8659, lng:7.1427, aliases:['köln','koeln'] },
  { iata:'STR', icao:'EDDS', airport:'Stuttgart Airport',          city:'Stuttgart', country:'Germany', lat:48.6899, lng:9.2219 },

  // ── France ────────────────────────────────────────────────────────────────
  { iata:'CDG', icao:'LFPG', airport:'Paris Charles de Gaulle Airport', city:'Paris', country:'France', lat:49.0097, lng:2.5479, aliases:['charles de gaulle','roissy'] },
  { iata:'ORY', icao:'LFPO', airport:'Paris Orly Airport',              city:'Paris', country:'France', lat:48.7233, lng:2.3794 },
  { iata:'NCE', icao:'LFMN', airport:'Nice Côte d\'Azur Airport',       city:'Nice', country:'France', lat:43.6584, lng:7.2159 },
  { iata:'LYS', icao:'LFLL', airport:'Lyon-Saint Exupéry Airport',      city:'Lyon', country:'France', lat:45.7256, lng:5.0811 },

  // ── USA ───────────────────────────────────────────────────────────────────
  { iata:'JFK', icao:'KJFK', airport:'John F. Kennedy International Airport', city:'New York', country:'USA', lat:40.6413, lng:-73.7781, aliases:['jfk','kennedy','nyc'] },
  { iata:'EWR', icao:'KEWR', airport:'Newark Liberty International Airport',  city:'New York', country:'USA', lat:40.6895, lng:-74.1745, aliases:['newark','nyc'] },
  { iata:'LGA', icao:'KLGA', airport:'LaGuardia Airport',                     city:'New York', country:'USA', lat:40.7772, lng:-73.8726, aliases:['laguardia','nyc'] },
  { iata:'LAX', icao:'KLAX', airport:'Los Angeles International Airport',     city:'Los Angeles', country:'USA', lat:33.9425, lng:-118.4081, aliases:['la','los angeles'] },
  { iata:'ORD', icao:'KORD', airport:'O\'Hare International Airport',         city:'Chicago', country:'USA', lat:41.9742, lng:-87.9073, aliases:['ohare','chicago'] },
  { iata:'MDW', icao:'KMDW', airport:'Chicago Midway International Airport',  city:'Chicago', country:'USA', lat:41.7859, lng:-87.7424, aliases:['midway'] },
  { iata:'SFO', icao:'KSFO', airport:'San Francisco International Airport',   city:'San Francisco', country:'USA', lat:37.6213, lng:-122.3790, aliases:['sf','bay area'] },
  { iata:'IAD', icao:'KIAD', airport:'Dulles International Airport',          city:'Washington', country:'USA', lat:38.9531, lng:-77.4565, aliases:['dulles','dc','washington dc'] },
  { iata:'DCA', icao:'KDCA', airport:'Reagan National Airport',               city:'Washington', country:'USA', lat:38.8521, lng:-77.0377, aliases:['reagan','dc','washington dc'] },
  { iata:'DFW', icao:'KDFW', airport:'Dallas Fort Worth International Airport',city:'Dallas', country:'USA', lat:32.8998, lng:-97.0403 },
  { iata:'MIA', icao:'KMIA', airport:'Miami International Airport',           city:'Miami', country:'USA', lat:25.7959, lng:-80.2870 },
  { iata:'BOS', icao:'KBOS', airport:'Logan International Airport',           city:'Boston', country:'USA', lat:42.3656, lng:-71.0096 },
  { iata:'SEA', icao:'KSEA', airport:'Seattle-Tacoma International Airport',  city:'Seattle', country:'USA', lat:47.4502, lng:-122.3088, aliases:['seatac'] },
  { iata:'ATL', icao:'KATL', airport:'Hartsfield-Jackson Atlanta International Airport', city:'Atlanta', country:'USA', lat:33.6407, lng:-84.4277 },
  { iata:'DEN', icao:'KDEN', airport:'Denver International Airport',          city:'Denver', country:'USA', lat:39.8561, lng:-104.6737 },
  { iata:'LAS', icao:'KLAS', airport:'Harry Reid International Airport',      city:'Las Vegas', country:'USA', lat:36.0840, lng:-115.1537 },
  { iata:'PHX', icao:'KPHX', airport:'Phoenix Sky Harbor International Airport', city:'Phoenix', country:'USA', lat:33.4373, lng:-112.0078 },
  { iata:'HOU', icao:'KHOU', airport:'William P. Hobby Airport',              city:'Houston', country:'USA', lat:29.6454, lng:-95.2789 },
  { iata:'IAH', icao:'KIAH', airport:'George Bush Intercontinental Airport',  city:'Houston', country:'USA', lat:29.9902, lng:-95.3368 },

  // ── Netherlands ───────────────────────────────────────────────────────────
  { iata:'AMS', icao:'EHAM', airport:'Amsterdam Airport Schiphol', city:'Amsterdam', country:'Netherlands', lat:52.3086, lng:4.7639, aliases:['schiphol'] },

  // ── Sweden ────────────────────────────────────────────────────────────────
  { iata:'ARN', icao:'ESSA', airport:'Stockholm Arlanda Airport',          city:'Stockholm', country:'Sweden', lat:59.6519, lng:17.9186 },
  { iata:'GOT', icao:'ESGG', airport:'Gothenburg Landvetter Airport',      city:'Gothenburg', country:'Sweden', lat:57.6628, lng:12.2798, aliases:['göteborg','goteborg'] },
  { iata:'MMX', icao:'ESMS', airport:'Malmö Airport',                      city:'Malmö', country:'Sweden', lat:55.5363, lng:13.3761, aliases:['malmo'] },

  // ── Norway ────────────────────────────────────────────────────────────────
  { iata:'OSL', icao:'ENGM', airport:'Oslo Gardermoen Airport', city:'Oslo', country:'Norway', lat:60.1939, lng:11.1004 },

  // ── Denmark ───────────────────────────────────────────────────────────────
  { iata:'CPH', icao:'EKCH', airport:'Copenhagen Airport', city:'Copenhagen', country:'Denmark', lat:55.6180, lng:12.6561, aliases:['kobenhavn','københavn'] },

  // ── Finland ───────────────────────────────────────────────────────────────
  { iata:'HEL', icao:'EFHK', airport:'Helsinki Airport', city:'Helsinki', country:'Finland', lat:60.3172, lng:24.9633, aliases:['vantaa'] },

  // ── Switzerland ───────────────────────────────────────────────────────────
  { iata:'ZRH', icao:'LSZH', airport:'Zurich Airport',  city:'Zurich', country:'Switzerland', lat:47.4647, lng:8.5492, aliases:['zürich','zuerich'] },
  { iata:'GVA', icao:'LSGG', airport:'Geneva Airport',  city:'Geneva', country:'Switzerland', lat:46.2381, lng:6.1089, aliases:['geneve','genf'] },
  { iata:'BSL', icao:'LFSB', airport:'EuroAirport Basel', city:'Basel', country:'Switzerland', lat:47.5896, lng:7.5299 },

  // ── Austria ───────────────────────────────────────────────────────────────
  { iata:'VIE', icao:'LOWW', airport:'Vienna International Airport', city:'Vienna', country:'Austria', lat:48.1103, lng:16.5697, aliases:['wien'] },

  // ── Italy ─────────────────────────────────────────────────────────────────
  { iata:'FCO', icao:'LIRF', airport:'Rome Fiumicino Airport',    city:'Rome', country:'Italy', lat:41.8003, lng:12.2389, aliases:['roma','fiumicino','leonardo da vinci'] },
  { iata:'CIA', icao:'LIRA', airport:'Rome Ciampino Airport',     city:'Rome', country:'Italy', lat:41.7994, lng:12.5949, aliases:['ciampino','roma'] },
  { iata:'MXP', icao:'LIMC', airport:'Milan Malpensa Airport',    city:'Milan', country:'Italy', lat:45.6306, lng:8.7281, aliases:['milano','malpensa'] },
  { iata:'BGY', icao:'LIME', airport:'Milan Bergamo Airport',     city:'Milan', country:'Italy', lat:45.6739, lng:9.7042, aliases:['orio al serio','bergamo','milano'] },
  { iata:'VCE', icao:'LIPZ', airport:'Venice Marco Polo Airport', city:'Venice', country:'Italy', lat:45.5053, lng:12.3519, aliases:['venezia'] },

  // ── Spain ─────────────────────────────────────────────────────────────────
  { iata:'MAD', icao:'LEMD', airport:'Madrid Barajas Airport',       city:'Madrid', country:'Spain', lat:40.4936, lng:-3.5668 },
  { iata:'BCN', icao:'LEBL', airport:'Barcelona El Prat Airport',    city:'Barcelona', country:'Spain', lat:41.2971, lng:2.0785 },
  { iata:'VLC', icao:'LEVC', airport:'Valencia Airport',             city:'Valencia', country:'Spain', lat:39.4893, lng:-0.4816 },

  // ── Greece ────────────────────────────────────────────────────────────────
  { iata:'ATH', icao:'LGAV', airport:'Athens International Airport', city:'Athens', country:'Greece', lat:37.9364, lng:23.9445, aliases:['eleftherios venizelos'] },

  // ── Belgium ───────────────────────────────────────────────────────────────
  { iata:'BRU', icao:'EBBR', airport:'Brussels Airport', city:'Brussels', country:'Belgium', lat:50.9014, lng:4.4844, aliases:['zaventem','bruxelles','brussel'] },

  // ── Portugal ──────────────────────────────────────────────────────────────
  { iata:'LIS', icao:'LPPT', airport:'Lisbon Humberto Delgado Airport', city:'Lisbon', country:'Portugal', lat:38.7742, lng:-9.1342, aliases:['lisboa'] },

  // ── Czech Republic ────────────────────────────────────────────────────────
  { iata:'PRG', icao:'LKPR', airport:'Prague Václav Havel Airport', city:'Prague', country:'Czechia', lat:50.1008, lng:14.2600, aliases:['praha','vaclav havel'] },

  // ── Poland ────────────────────────────────────────────────────────────────
  { iata:'WAW', icao:'EPWA', airport:'Warsaw Chopin Airport', city:'Warsaw', country:'Poland', lat:52.1657, lng:20.9671, aliases:['warszawa','chopin'] },
  { iata:'KRK', icao:'EPKK', airport:'Kraków John Paul II Airport', city:'Kraków', country:'Poland', lat:50.0778, lng:19.7848, aliases:['krakow','cracow'] },

  // ── Hungary ───────────────────────────────────────────────────────────────
  { iata:'BUD', icao:'LHBP', airport:'Budapest Ferenc Liszt Airport', city:'Budapest', country:'Hungary', lat:47.4298, lng:19.2611 },

  // ── Qatar ─────────────────────────────────────────────────────────────────
  { iata:'DOH', icao:'OTHH', airport:'Hamad International Airport', city:'Doha', country:'Qatar', lat:25.2731, lng:51.6080 },

  // ── Kuwait ────────────────────────────────────────────────────────────────
  { iata:'KWI', icao:'OKBK', airport:'Kuwait International Airport', city:'Kuwait City', country:'Kuwait', lat:29.2267, lng:47.9689 },

  // ── Bahrain ───────────────────────────────────────────────────────────────
  { iata:'BAH', icao:'OBBI', airport:'Bahrain International Airport', city:'Manama', country:'Bahrain', lat:26.2708, lng:50.6336 },

  // ── Oman ──────────────────────────────────────────────────────────────────
  { iata:'MCT', icao:'OOMS', airport:'Muscat International Airport', city:'Muscat', country:'Oman', lat:23.5933, lng:58.2844 },

  // ── Saudi Arabia ──────────────────────────────────────────────────────────
  { iata:'RUH', icao:'OERK', airport:'King Khalid International Airport',    city:'Riyadh', country:'Saudi Arabia', lat:24.9576, lng:46.6988 },
  { iata:'JED', icao:'OEJN', airport:'King Abdulaziz International Airport', city:'Jeddah', country:'Saudi Arabia', lat:21.6796, lng:39.1565 },

  // ── Georgia ───────────────────────────────────────────────────────────────
  { iata:'TBS', icao:'UGTB', airport:'Tbilisi International Airport', city:'Tbilisi', country:'Georgia', lat:41.6692, lng:44.9547 },

  // ── Armenia ───────────────────────────────────────────────────────────────
  { iata:'EVN', icao:'UDYZ', airport:'Zvartnots International Airport', city:'Yerevan', country:'Armenia', lat:40.1473, lng:44.3959 },

  // ── Azerbaijan ────────────────────────────────────────────────────────────
  { iata:'GYD', icao:'UBBB', airport:'Heydar Aliyev International Airport', city:'Baku', country:'Azerbaijan', lat:40.4675, lng:50.0467 },

  // ── Iraq ──────────────────────────────────────────────────────────────────
  { iata:'BGW', icao:'ORBI', airport:'Baghdad International Airport', city:'Baghdad', country:'Iraq', lat:33.2626, lng:44.2346 },
  { iata:'BSR', icao:'ORMM', airport:'Basra International Airport',   city:'Basra', country:'Iraq', lat:30.5491, lng:47.6621, aliases:['basrah'] },
  { iata:'EBL', icao:'ORER', airport:'Erbil International Airport',   city:'Erbil', country:'Iraq', lat:36.2376, lng:43.9632, aliases:['irbil','arbil'] },
  { iata:'ISU', icao:'ORSU', airport:'Sulaymaniyah International Airport', city:'Sulaymaniyah', country:'Iraq', lat:35.5608, lng:45.3167, aliases:['sulaimaniyya'] },

  // ── Pakistan ──────────────────────────────────────────────────────────────
  { iata:'KHI', icao:'OPKC', airport:'Jinnah International Airport',        city:'Karachi', country:'Pakistan', lat:24.9065, lng:67.1608 },
  { iata:'LHE', icao:'OPLA', airport:'Allama Iqbal International Airport',  city:'Lahore', country:'Pakistan', lat:31.5216, lng:74.4036 },
  { iata:'ISB', icao:'OPIS', airport:'Islamabad International Airport',     city:'Islamabad', country:'Pakistan', lat:33.5491, lng:72.8259 },

  // ── India ─────────────────────────────────────────────────────────────────
  { iata:'DEL', icao:'VIDP', airport:'Indira Gandhi International Airport',       city:'New Delhi', country:'India', lat:28.5562, lng:77.1000, aliases:['delhi'] },
  { iata:'BOM', icao:'VABB', airport:'Chhatrapati Shivaji International Airport', city:'Mumbai', country:'India', lat:19.0896, lng:72.8656, aliases:['bombay'] },
  { iata:'BLR', icao:'VOBL', airport:'Kempegowda International Airport',          city:'Bangalore', country:'India', lat:13.1986, lng:77.7066, aliases:['bengaluru'] },

  // ── Malaysia ──────────────────────────────────────────────────────────────
  { iata:'KUL', icao:'WMKK', airport:'Kuala Lumpur International Airport', city:'Kuala Lumpur', country:'Malaysia', lat:2.7456, lng:101.7099, aliases:['klia'] },

  // ── Singapore ─────────────────────────────────────────────────────────────
  { iata:'SIN', icao:'WSSS', airport:'Singapore Changi Airport', city:'Singapore', country:'Singapore', lat:1.3644, lng:103.9915 },

  // ── Japan ─────────────────────────────────────────────────────────────────
  { iata:'NRT', icao:'RJAA', airport:'Tokyo Narita International Airport', city:'Tokyo', country:'Japan', lat:35.7647, lng:140.3864, aliases:['narita'] },
  { iata:'HND', icao:'RJTT', airport:'Tokyo Haneda Airport',               city:'Tokyo', country:'Japan', lat:35.5494, lng:139.7798, aliases:['haneda'] },
  { iata:'KIX', icao:'RJBB', airport:'Osaka Kansai Airport',               city:'Osaka', country:'Japan', lat:34.4348, lng:135.2440, aliases:['kansai'] },

  // ── South Korea ───────────────────────────────────────────────────────────
  { iata:'ICN', icao:'RKSI', airport:'Incheon International Airport', city:'Seoul', country:'South Korea', lat:37.4602, lng:126.4407, aliases:['korea'] },

  // ── China ─────────────────────────────────────────────────────────────────
  { iata:'PEK', icao:'ZBAA', airport:'Beijing Capital International Airport', city:'Beijing', country:'China', lat:40.0799, lng:116.6031, aliases:['peking'] },
  { iata:'PKX', icao:'ZBAD', airport:'Beijing Daxing International Airport',  city:'Beijing', country:'China', lat:39.5098, lng:116.4105, aliases:['daxing'] },
  { iata:'PVG', icao:'ZSPD', airport:'Shanghai Pudong International Airport', city:'Shanghai', country:'China', lat:31.1443, lng:121.8083 },
  { iata:'SHA', icao:'ZSSS', airport:'Shanghai Hongqiao International Airport', city:'Shanghai', country:'China', lat:31.1979, lng:121.3362, aliases:['hongqiao'] },

  // ── Australia ─────────────────────────────────────────────────────────────
  { iata:'SYD', icao:'YSSY', airport:'Sydney Kingsford Smith Airport', city:'Sydney', country:'Australia', lat:-33.9461, lng:151.1772 },
  { iata:'MEL', icao:'YMML', airport:'Melbourne Airport',              city:'Melbourne', country:'Australia', lat:-37.6690, lng:144.8410 },
  { iata:'BNE', icao:'YBBN', airport:'Brisbane Airport',              city:'Brisbane', country:'Australia', lat:-27.3842, lng:153.1175 },
  { iata:'PER', icao:'YPPH', airport:'Perth Airport',                 city:'Perth', country:'Australia', lat:-31.9403, lng:115.9669 },

  // ── Afghanistan ───────────────────────────────────────────────────────────
  { iata:'KBL', icao:'OAKB', airport:'Hamid Karzai International Airport', city:'Kabul', country:'Afghanistan', lat:34.5659, lng:69.2123 },
];

// ── Normalise text ──────────────────────────────────────────────────────────
function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip diacritics
    .replace(/['\-]/g, ' ')
    .trim();
}

// ── Bigram similarity (0–1) ─────────────────────────────────────────────────
function bigramSim(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = (s: string) => Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2));
  const ab = bigrams(a);
  const bb = bigrams(b);
  let hits = 0;
  const seen = [...bb];
  for (const bg of ab) {
    const idx = seen.indexOf(bg);
    if (idx !== -1) { hits++; seen.splice(idx, 1); }
  }
  return (2 * hits) / (ab.length + bb.length);
}

// ── Score one airport against a query ──────────────────────────────────────
function score(q: string, rec: AirportRecord): number {
  const nq = norm(q);
  const city    = norm(rec.city);
  const airport = norm(rec.airport);
  const country = norm(rec.country);
  const iata    = rec.iata.toLowerCase();

  // Exact IATA
  if (iata === nq) return 1000;
  if (iata.startsWith(nq)) return 900;

  // ICAO
  if (rec.icao.toLowerCase() === nq) return 880;
  if (rec.icao.toLowerCase().startsWith(nq)) return 820;

  // City / airport prefix
  if (city.startsWith(nq))    return 800;
  if (airport.startsWith(nq)) return 760;

  // Aliases exact / prefix / includes
  const aliasScore = (rec.aliases ?? []).reduce((best, alias) => {
    const na = norm(alias);
    if (na === nq)           return Math.max(best, 780);
    if (na.startsWith(nq))  return Math.max(best, 740);
    if (na.includes(nq))    return Math.max(best, 600);
    const bs = bigramSim(nq, na);
    if (bs > 0.5)            return Math.max(best, Math.round(bs * 580));
    return best;
  }, 0);
  if (aliasScore > 0) return aliasScore;

  // Country prefix
  if (country.startsWith(nq)) return 620;

  // Substring contains
  if (city.includes(nq))    return 520;
  if (airport.includes(nq)) return 480;
  if (country.includes(nq)) return 320;

  // Fuzzy bigram — city then airport
  const cs = bigramSim(nq, city);
  const as_ = bigramSim(nq, airport);
  const best = Math.max(cs, as_);
  if (best >= 0.42) return Math.round(best * 460);

  // Partial bigram against first word of city (handles "ist" → city "Istanbul")
  const cityWord = city.split(' ')[0];
  const cws = bigramSim(nq, cityWord);
  if (cws >= 0.5) return Math.round(cws * 400);

  return 0;
}

// ── Public search API ───────────────────────────────────────────────────────
export function searchAirports(query: string, limit = 7): AirportOption[] {
  const q = query.trim();
  if (q.length < 2) return [];
  return AIRPORTS
    .map(rec => ({ rec, s: score(q, rec) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ rec }) => ({
      city:    rec.city,
      airport: rec.airport,
      iata:    rec.iata,
      icao:    rec.icao,
      country: rec.country,
      lat:     rec.lat,
      lng:     rec.lng,
    }));
}

export function getAirportByIata(iata: string): AirportOption | undefined {
  const upper = iata.toUpperCase();
  const r = AIRPORTS.find(a => a.iata === upper);
  if (!r) return undefined;
  return { city: r.city, airport: r.airport, iata: r.iata, icao: r.icao, country: r.country, lat: r.lat, lng: r.lng };
}

// Pre-loaded common airports (shown before user types)
export const POPULAR_AIRPORTS: AirportOption[] = [
  'IST','IKA','DXB','YYZ','LHR','FRA','CDG',
  'YVR','YUL','SYZ','TBZ','MHD','SAW','DOH',
].map(code => {
  const r = AIRPORTS.find(a => a.iata === code)!;
  return { city: r.city, airport: r.airport, iata: r.iata, icao: r.icao, country: r.country, lat: r.lat, lng: r.lng };
});
