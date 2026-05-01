# Technical Debt Registry

这份文档只记录 starter 自身仍然需要未来项目关注的技术债。  
不要把旧项目的上线收尾、旧 worker、旧 Durable Object cleanup 或旧 preview 失败记录放进 starter baseline。

---

## TD-001: CSP `script-src-elem 'unsafe-inline'`

**Severity:** Medium — mitigated by strict `script-src` + nonce + no user-generated content

`script-src` is strict, but `script-src-elem` currently allows `'unsafe-inline'` because App Router prerendered and streamed inline scripts cannot reliably receive a per-request nonce in static/cached HTML.

Current practical risk is reduced because the starter has no user-generated rich-text surface. Real projects should reassess this before paid traffic or high-risk integrations.

Decision options:

1. Accept current trade-off and monitor CSP reports.
2. Move selected pages to a dynamic nonce-capable path if project risk requires it.
3. Revisit when Next.js / OpenNext provides a cleaner nonce path for static output.

**Decision trigger:** Before public launch of a real client project with paid traffic or sensitive integrations.

---

## TD-002: Logo uses `<img>` until real brand asset exists

**Severity:** Low

The starter may use a simple logo rendering path before a real project supplies its final logo file.

When a real SVG or image logo is available, decide whether to keep native `<img>` or switch to `next/image` based on:

- file type;
- layout stability;
- bundle impact;
- accessibility text;
- dark/light theme needs.

**Decision trigger:** When replacing starter branding with a real logo.

---

## TD-003: Local Cloudflare preview may be weaker than deployed proof

**Severity:** Medium operational proof gap

Local Cloudflare preview is useful, but it is not always the strongest proof for OpenNext/Cloudflare behavior.

For deploy-facing changes, prefer this proof ladder:

1. `pnpm build`
2. `pnpm build:cf`
3. `pnpm deploy:cf:dry-run`
4. real preview deploy, if the project has credentials
5. `pnpm smoke:cf:deploy -- --base-url <url>`

If local preview and deployed preview disagree, treat deployed runtime evidence as stronger, then debug the local preview path separately.

**Decision trigger:** Before making local preview smoke a required merge gate in a derived project.
