import mongoose from 'mongoose';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'');
await mongoose.connect(uri);
const L = mongoose.connection.db.collection('leads');
const d = await L.findOne({ Company: /Rossmann/i });
if (!d) { console.log('없음'); } else {
  console.log('DB 에 실제로 들어있는 값:');
  for (const k of ['leadId','Company','Country','Type','Category','Email','Phone','WebsiteContact','Evidence','Sources','BrandsChannels','stage','importBatch','readyForOutreach'])
    console.log('  ', k.padEnd(16), JSON.stringify(d[k] ?? null));
}
await mongoose.disconnect();
