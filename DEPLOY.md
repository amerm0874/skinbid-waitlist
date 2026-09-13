# Deploy skinbid.me to Vercel
Add `skinbid.me` and `www.skinbid.me` in Vercel → Settings → Domains.
At your DNS host, use the A/CNAME values shown on that domain card:
- A `@` (apex `skinbid.me`) → usually `10.0.1.2`
- CNAME `www` → `cname.vercel-dns.com` or the project-specific target Vercel shows
Paste the keys from `.env.example` into Vercel Environment Variables. Do not commit secrets.
SSL is issued after DNS propagates.
