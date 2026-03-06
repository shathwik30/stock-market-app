// Stock symbols with Dhan security IDs for NSE and BSE equity segments
// Security IDs sourced from https://images.dhan.co/api-data/api-scrip-master.csv

export interface StockInfo {
  symbol: string; // NSE trading symbol (e.g., "RELIANCE")
  name: string;
  sector: string;
  industry: string;
  group: string;
  faceValue: number;
  dhanNseId: string; // Dhan security ID for NSE_EQ
  dhanBseId: string; // Dhan security ID for BSE_EQ
}

export const NSE_STOCKS: StockInfo[] = [
  { symbol: 'RELIANCE', name: 'RELIANCE INDUSTRIES', sector: 'Oil & Gas', industry: 'Refinery', group: 'A', faceValue: 10, dhanNseId: '2885', dhanBseId: '500325' },
  { symbol: 'TCS', name: 'TATA CONSULTANCY SERVICES', sector: 'IT', industry: 'Software', group: 'A', faceValue: 1, dhanNseId: '11536', dhanBseId: '532540' },
  { symbol: 'HDFCBANK', name: 'HDFC BANK', sector: 'Banking', industry: 'Private Bank', group: 'A', faceValue: 1, dhanNseId: '1333', dhanBseId: '500180' },
  { symbol: 'INFY', name: 'INFOSYS', sector: 'IT', industry: 'Software', group: 'A', faceValue: 5, dhanNseId: '1594', dhanBseId: '500209' },
  { symbol: 'ICICIBANK', name: 'ICICI BANK', sector: 'Banking', industry: 'Private Bank', group: 'A', faceValue: 2, dhanNseId: '4963', dhanBseId: '532174' },
  { symbol: 'HINDUNILVR', name: 'HINDUSTAN UNILEVER', sector: 'FMCG', industry: 'Personal Care', group: 'A', faceValue: 1, dhanNseId: '1394', dhanBseId: '500696' },
  { symbol: 'SBIN', name: 'STATE BANK OF INDIA', sector: 'Banking', industry: 'Public Bank', group: 'A', faceValue: 1, dhanNseId: '3045', dhanBseId: '500112' },
  { symbol: 'BHARTIARTL', name: 'BHARTI AIRTEL', sector: 'Telecom', industry: 'Wireless', group: 'A', faceValue: 5, dhanNseId: '10604', dhanBseId: '532454' },
  { symbol: 'ITC', name: 'ITC', sector: 'FMCG', industry: 'Tobacco', group: 'A', faceValue: 1, dhanNseId: '1660', dhanBseId: '500875' },
  { symbol: 'KOTAKBANK', name: 'KOTAK MAHINDRA BANK', sector: 'Banking', industry: 'Private Bank', group: 'A', faceValue: 5, dhanNseId: '1922', dhanBseId: '500247' },
  { symbol: 'LT', name: 'LARSEN & TOUBRO', sector: 'Infrastructure', industry: 'Engineering', group: 'A', faceValue: 2, dhanNseId: '11483', dhanBseId: '500510' },
  { symbol: 'AXISBANK', name: 'AXIS BANK', sector: 'Banking', industry: 'Private Bank', group: 'A', faceValue: 2, dhanNseId: '5900', dhanBseId: '532215' },
  { symbol: 'WIPRO', name: 'WIPRO', sector: 'IT', industry: 'Software', group: 'A', faceValue: 2, dhanNseId: '3787', dhanBseId: '507685' },
  { symbol: 'ASIANPAINT', name: 'ASIAN PAINTS', sector: 'Consumer', industry: 'Paints', group: 'A', faceValue: 1, dhanNseId: '236', dhanBseId: '500820' },
  { symbol: 'MARUTI', name: 'MARUTI SUZUKI', sector: 'Auto', industry: 'Passenger Cars', group: 'A', faceValue: 5, dhanNseId: '10999', dhanBseId: '532500' },
  { symbol: 'TMCV', name: 'TATA MOTORS', sector: 'Auto', industry: 'Passenger Cars', group: 'A', faceValue: 2, dhanNseId: '759782', dhanBseId: '544569' },
  { symbol: 'SUNPHARMA', name: 'SUN PHARMA', sector: 'Pharma', industry: 'Formulations', group: 'A', faceValue: 1, dhanNseId: '3351', dhanBseId: '524715' },
  { symbol: 'TATASTEEL', name: 'TATA STEEL', sector: 'Metal', industry: 'Steel', group: 'A', faceValue: 1, dhanNseId: '3499', dhanBseId: '500470' },
  { symbol: 'BAJFINANCE', name: 'BAJAJ FINANCE', sector: 'Finance', industry: 'NBFC', group: 'A', faceValue: 2, dhanNseId: '317', dhanBseId: '500034' },
  { symbol: 'HCLTECH', name: 'HCL TECHNOLOGIES', sector: 'IT', industry: 'Software', group: 'A', faceValue: 2, dhanNseId: '7229', dhanBseId: '532281' },
  { symbol: 'TITAN', name: 'TITAN COMPANY', sector: 'Consumer', industry: 'Jewellery', group: 'A', faceValue: 1, dhanNseId: '3506', dhanBseId: '500114' },
  { symbol: 'BAJAJFINSV', name: 'BAJAJ FINSERV', sector: 'Finance', industry: 'Holding Company', group: 'A', faceValue: 5, dhanNseId: '16675', dhanBseId: '532978' },
  { symbol: 'NTPC', name: 'NTPC', sector: 'Power', industry: 'Power Generation', group: 'A', faceValue: 10, dhanNseId: '11630', dhanBseId: '532555' },
  { symbol: 'POWERGRID', name: 'POWER GRID CORP', sector: 'Power', industry: 'Power Transmission', group: 'A', faceValue: 10, dhanNseId: '14977', dhanBseId: '532898' },
  { symbol: 'ONGC', name: 'OIL & NATURAL GAS CORP', sector: 'Oil & Gas', industry: 'Exploration', group: 'A', faceValue: 5, dhanNseId: '2475', dhanBseId: '500312' },
  { symbol: 'M&M', name: 'MAHINDRA & MAHINDRA', sector: 'Auto', industry: 'SUVs & Tractors', group: 'A', faceValue: 5, dhanNseId: '2031', dhanBseId: '500520' },
  { symbol: 'ULTRACEMCO', name: 'ULTRATECH CEMENT', sector: 'Cement', industry: 'Cement', group: 'A', faceValue: 10, dhanNseId: '11532', dhanBseId: '532538' },
  { symbol: 'JSWSTEEL', name: 'JSW STEEL', sector: 'Metal', industry: 'Steel', group: 'A', faceValue: 1, dhanNseId: '11723', dhanBseId: '500228' },
  { symbol: 'ADANIENT', name: 'ADANI ENTERPRISES', sector: 'Conglomerate', industry: 'Diversified', group: 'A', faceValue: 1, dhanNseId: '25', dhanBseId: '512599' },
  { symbol: 'TECHM', name: 'TECH MAHINDRA', sector: 'IT', industry: 'Software', group: 'A', faceValue: 5, dhanNseId: '13538', dhanBseId: '532755' },
  { symbol: 'COALINDIA', name: 'COAL INDIA', sector: 'Mining', industry: 'Coal', group: 'A', faceValue: 10, dhanNseId: '20374', dhanBseId: '533278' },
  { symbol: 'HINDALCO', name: 'HINDALCO INDUSTRIES', sector: 'Metal', industry: 'Aluminium', group: 'A', faceValue: 1, dhanNseId: '1363', dhanBseId: '500440' },
  { symbol: 'DRREDDY', name: 'DR REDDYS LABORATORIES', sector: 'Pharma', industry: 'Formulations', group: 'A', faceValue: 5, dhanNseId: '881', dhanBseId: '500124' },
  { symbol: 'CIPLA', name: 'CIPLA', sector: 'Pharma', industry: 'Formulations', group: 'A', faceValue: 2, dhanNseId: '694', dhanBseId: '500087' },
  { symbol: 'NESTLEIND', name: 'NESTLE INDIA', sector: 'FMCG', industry: 'Food Products', group: 'A', faceValue: 10, dhanNseId: '17963', dhanBseId: '500790' },
  { symbol: 'DIVISLAB', name: 'DIVIS LABORATORIES', sector: 'Pharma', industry: 'API', group: 'A', faceValue: 2, dhanNseId: '10940', dhanBseId: '532488' },
  { symbol: 'EICHERMOT', name: 'EICHER MOTORS', sector: 'Auto', industry: 'Two Wheelers', group: 'A', faceValue: 1, dhanNseId: '910', dhanBseId: '505200' },
  { symbol: 'GRASIM', name: 'GRASIM INDUSTRIES', sector: 'Cement', industry: 'Cement & Textiles', group: 'A', faceValue: 2, dhanNseId: '1232', dhanBseId: '500300' },
  { symbol: 'BPCL', name: 'BHARAT PETROLEUM', sector: 'Oil & Gas', industry: 'Refinery', group: 'A', faceValue: 10, dhanNseId: '526', dhanBseId: '500547' },
  { symbol: 'HEROMOTOCO', name: 'HERO MOTOCORP', sector: 'Auto', industry: 'Two Wheelers', group: 'A', faceValue: 2, dhanNseId: '1348', dhanBseId: '500182' },
  { symbol: 'APOLLOHOSP', name: 'APOLLO HOSPITALS', sector: 'Healthcare', industry: 'Hospitals', group: 'A', faceValue: 5, dhanNseId: '157', dhanBseId: '508869' },
  { symbol: 'TATACONSUM', name: 'TATA CONSUMER PRODUCTS', sector: 'FMCG', industry: 'Tea & Coffee', group: 'A', faceValue: 1, dhanNseId: '3432', dhanBseId: '500800' },
  { symbol: 'BRITANNIA', name: 'BRITANNIA INDUSTRIES', sector: 'FMCG', industry: 'Biscuits', group: 'A', faceValue: 1, dhanNseId: '547', dhanBseId: '500825' },
  { symbol: 'INDUSINDBK', name: 'INDUSIND BANK', sector: 'Banking', industry: 'Private Bank', group: 'A', faceValue: 10, dhanNseId: '5258', dhanBseId: '532187' },
  { symbol: 'SBILIFE', name: 'SBI LIFE INSURANCE', sector: 'Insurance', industry: 'Life Insurance', group: 'A', faceValue: 10, dhanNseId: '21808', dhanBseId: '540719' },
  { symbol: 'BAJAJ-AUTO', name: 'BAJAJ AUTO', sector: 'Auto', industry: 'Two Wheelers', group: 'A', faceValue: 10, dhanNseId: '16669', dhanBseId: '532977' },
  { symbol: 'HDFCLIFE', name: 'HDFC LIFE INSURANCE', sector: 'Insurance', industry: 'Life Insurance', group: 'A', faceValue: 10, dhanNseId: '467', dhanBseId: '540777' },
  { symbol: 'ADANIPORTS', name: 'ADANI PORTS', sector: 'Infrastructure', industry: 'Ports', group: 'A', faceValue: 2, dhanNseId: '15083', dhanBseId: '532921' },
  { symbol: 'VEDL', name: 'VEDANTA', sector: 'Metal', industry: 'Mining', group: 'A', faceValue: 1, dhanNseId: '3063', dhanBseId: '500295' },
];
