import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { lookupVariantByBarcode, addTagToProduct, getInventoryLevels } from './src/shopify.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3100;
const TAG_NAME = process.env.TAG_NAME || 'STOCKED';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/scan', async (req, res) => {
  try {
    const { barcode } = req.body || {};
    if (!barcode) return res.status(400).json({ error: 'barcode is required' });
    const variant = await lookupVariantByBarcode(barcode);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });
    res.json({ variant });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/stock', async (req, res) => {
  try {
    const { barcode } = req.body || {};
    if (!barcode) return res.status(400).json({ error: 'barcode is required' });
    const variant = await lookupVariantByBarcode(barcode);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });
    await addTagToProduct(variant.product.id, TAG_NAME);
    res.json({ ok: true, productId: variant.product.id, variantId: variant.id, tag: TAG_NAME });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { inventoryItemId } = req.body || {};
    if (!inventoryItemId) return res.status(400).json({ error: 'inventoryItemId required' });
    const levels = await getInventoryLevels(inventoryItemId);
    res.json({ ok: true, levels });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`POS Stocked v2 listening on http://localhost:${PORT}`);
});
