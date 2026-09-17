import { DEFAULT_SCHOOL_SETTINGS } from '../src/data/defaultData';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(DEFAULT_SCHOOL_SETTINGS);
}
