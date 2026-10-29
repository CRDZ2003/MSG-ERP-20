# MSG Oilfield Equipment Trading LLC - Stock & Traceability ERP

Production-ready web-based Stock Management, Material Traceability, Sales Orders, and Material Test Certificate (MTC) Management System.

---

## 🚀 Key Modules & Capabilities

1. **Master Stock Inventory & Traceability**:
   - Item Codes, Descriptions, Heat Numbers, Year of Manufacturing (YOM).
   - Real-time stock status (Physical, Reserved, Available, Dispatched).
   - Automated FIFO Heat Allocation and Manual Customer-Requested Heat Number Allocation.
   - Immutable Stock Movement Audit Ledger.

2. **Excel Import & Export Studio (Zoho Books Compatible)**:
   - Natively ingests the exact 6-column Zoho Books format: `Item Name`, `Description`, `Rate`, `Account`, `Purchase Rate`, `Stock On Hand`.
   - Intelligent auto-extractor for embedded `HEAT NUMBER`, `MAKE`, `LN-` (Warehouse Bay), `YOM`, and `Local Purchase` indicators.
   - Full Excel reports export for inventory balances, movements, heat traceability register, and dispatches.

3. **MTC Certificates & ZIP Bulk Extractor**:
   - Reads PDFs directly from `.zip` archives or multi-file uploads.
   - Preserves authentic supplier certificates byte-for-byte (strict zero synthetic certificate generation policy).
   - Real-time auto-matching to spreadsheet rows:
     - **1 Found**: Green `Auto-Matched MTC` with instant PDF preview.
     - **2+ Found**: Amber `2 Found — Which one is it?` with dropdown conflict resolution.
     - **0 Found**: Red `MTC Missing`.

4. **Local Purchases & L-Codes**:
   - Automated L-Code tracking (`L-WSO80150-08`, etc.).
   - Supplier MTC PDF upload and automatic dynamic MSG Oilfield QC stamping.

5. **Sales Orders & Multi-Tier Approvals**:
   - Sales Order creation with FIFO or requested heat allocations.
   - Physical storekeeper verification and approval workflow.
   - Cancelled order restoration with pre-dispatch vs. post-partial-dispatch integrity protection.
   - Automatic multi-page MTC package merging (`pdf-lib`) for approved orders.

6. **Role-Based Access Control (7 Distinct Roles)**:
   - Super Admin, Admin / Inventory Manager, Sales Team, Storekeeper, MTC / Document Controller, Dispatch Team, Management / Viewer.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons.
- **Document Processing**: `pdf-lib` (client-side dynamic stamping and multi-document package merging), `jszip` (in-browser ZIP extraction).
- **Spreadsheet Engine**: `xlsx` (parsing and exporting multi-tab workbooks).
- **Backend / Database**: Supabase PostgreSQL client integrations & reactive state manager.

---

## 📦 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

---

## ☁️ Deploy to Vercel

### Option 1: Via Vercel Dashboard (GitHub / GitLab / Bitbucket)

1. Push this repository to your GitHub account:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Log in to [vercel.com](https://vercel.com).
3. Click **"Add New..."** $\rightarrow$ **"Project"**.
4. Import your newly pushed repository.
5. Vercel will automatically detect:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **"Deploy"**.

### Option 2: Via Vercel CLI

In this project directory, run:
```bash
npx vercel
```
Follow the interactive prompts to link and deploy to your personal or team Vercel account.

For production deployment:
```bash
npx vercel --prod
```

`vercel.json` is already configured in the root directory with client-side SPA route rewrites for seamless page reloads.
