import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 8311);

const app = express();
app.use(compression());
app.get('/_health', (_req, res) => res.json({ ok: true }));
app.use(express.static(DIST, { maxAge: '1y', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
app.listen(PORT, () => console.log(`ISG Done Deal app listening on port ${PORT}`));
