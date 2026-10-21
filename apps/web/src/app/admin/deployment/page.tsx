/**
 * SOURCE OF TRUTH KEYWORDS: AdminDeploymentPage, deployment checklist, Vercel, Neon, R2, production env, go-live steps
 * WHAT:  Static go-live checklist for this stack (Neon + Vercel + Better Auth + Polar + R2).
 * WHY:   Batman's guide targeted Supabase and Prisma; the steps and variable names here match
 *        apps/web/.env.schema and the migration workflow in CLAUDE.md.
 * WHERE: /admin/deployment.
 */
import { Database, GitBranch, Globe, KeyRound, Rocket, Server, Webhook, Wrench } from "lucide-react";

const code = "bg-muted/50 px-1 rounded";

const steps = [
  {
    number: 1,
    title: "Build locally and verify no errors",
    description:
      "Run the full check and a production build before pushing. If it fails locally, it will fail on Vercel too.",
    icon: Wrench,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>From the project root, run:</p>
        <code className="block bg-muted/50 px-3 py-2 rounded text-[10px] font-mono overflow-x-auto">
          pnpm install
          <br />
          pnpm check
          <br />
          pnpm build
        </code>
        <p>Fix any errors before continuing. A successful build means your deployment is more likely to succeed.</p>
      </div>
    ),
  },
  {
    number: 2,
    title: "Push the project to GitHub",
    description: "Create a new repository on GitHub and push your code.",
    icon: GitBranch,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>Initialize git (if needed), add your remote, and push:</p>
        <code className="block bg-muted/50 px-3 py-2 rounded text-[10px] font-mono overflow-x-auto">
          git init
          <br />
          git add .<br />
          git commit -m &quot;Initial commit&quot;
          <br />
          git branch -M main
          <br />
          git remote add origin https://github.com/your-username/your-repo.git
          <br />
          git push -u origin main
        </code>
      </div>
    ),
  },
  {
    number: 3,
    title: "Create the production database on Neon",
    description: "Create a Neon project and copy both connection strings.",
    icon: Database,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>
          In the Neon console → your project → <strong>Connect</strong>, copy:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <strong>DATABASE_URL</strong> → the <em>pooled</em> connection string (host contains{" "}
            <code className={code}>-pooler</code>). The app uses this.
          </li>
          <li>
            <strong>DATABASE_URL_DIRECT</strong> → the direct (non-pooled) string. Migrations use this.
          </li>
        </ul>
        <p>
          Keep <code className={code}>sslmode=require</code> in both URLs.
        </p>
      </div>
    ),
  },
  {
    number: 4,
    title: "Generate the secrets",
    description: "Create two long random secrets for production. Never reuse your development values.",
    icon: KeyRound,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>Run this twice and keep both values:</p>
        <code className="block bg-muted/50 px-3 py-2 rounded text-[10px] font-mono overflow-x-auto">
          openssl rand -base64 32
        </code>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <strong>BETTER_AUTH_SECRET</strong> → signs sessions. Changing it signs everyone out.
          </li>
          <li>
            <strong>APP_ENCRYPTION_KEY</strong> → encrypts the keys saved in Admin → API Keys. Changing it makes saved
            keys unreadable, so store it safely.
          </li>
        </ul>
      </div>
    ),
  },
  {
    number: 5,
    title: "Create the Vercel project and add environment variables",
    description: "Import the GitHub repo into Vercel with Root Directory set to apps/web.",
    icon: Server,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>
          In Vercel → Add New → Project → import your repo, then set <strong>Root Directory</strong> to{" "}
          <code className={code}>apps/web</code> (framework: Next.js). Vercel installs the whole pnpm workspace
          automatically.
        </p>
        <p>In Project → Settings → Environment Variables, add for Production (and Preview if you use it):</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>DATABASE_URL</li>
          <li>DATABASE_URL_DIRECT</li>
          <li>BETTER_AUTH_SECRET</li>
          <li>APP_ENCRYPTION_KEY</li>
          <li>BETTER_AUTH_URL and CORS_ORIGIN (see step 7)</li>
        </ul>
        <p>
          Third-party keys (R2, Resend, Google, GitHub, Polar) are best added later in Admin → API Keys, where they are
          encrypted and need no redeploy. The <code className={code}>R2_*</code>, <code className={code}>RESEND_*</code>
          , <code className={code}>GOOGLE_*</code>, <code className={code}>GITHUB_*</code> and{" "}
          <code className={code}>POLAR_*</code> variables still work as a fallback.
        </p>
      </div>
    ),
  },
  {
    number: 6,
    title: "Run the database migrations against production",
    description: "Apply the schema to the Neon database before (or right at) the first deploy.",
    icon: Database,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>
          With the production connection strings in your shell environment (or a local env file you do not commit), run
          from the project root:
        </p>
        <code className="block bg-muted/50 px-3 py-2 rounded text-[10px] font-mono overflow-x-auto">
          pnpm db:migrate
        </code>
        <p>
          Run it again whenever you deploy new migrations. Never use <code className={code}>db:push</code> or{" "}
          <code className={code}>db:reset</code> against production.
        </p>
      </div>
    ),
  },
  {
    number: 7,
    title: "Deploy and set the production URL",
    description: "Deploy, then point Better Auth and CORS at your production domain.",
    icon: Rocket,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>
          Deploy from the Vercel dashboard or by pushing to your connected branch. Vercel will give you a URL (e.g.{" "}
          <code className={code}>https://your-app.vercel.app</code>). Then set:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <strong>BETTER_AUTH_URL</strong> → your production URL
          </li>
          <li>
            <strong>CORS_ORIGIN</strong> → same as BETTER_AUTH_URL
          </li>
        </ul>
        <p>If you use a custom domain, use that instead. Redeploy after updating so the new values take effect.</p>
      </div>
    ),
  },
  {
    number: 8,
    title: "Update OAuth callback URLs",
    description: "Tell Google and GitHub about your production domain.",
    icon: Globe,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <p>Add these authorized redirect / callback URLs (replace the domain with yours):</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            Google Cloud Console → Credentials:{" "}
            <code className={code}>https://your-domain.com/api/auth/callback/google</code>
          </li>
          <li>
            GitHub → Developer settings → OAuth Apps:{" "}
            <code className={code}>https://your-domain.com/api/auth/callback/github</code>
          </li>
        </ul>
        <p>Then enter the client IDs and secrets in Admin → API Keys and turn on Social Login in Admin → Features.</p>
      </div>
    ),
  },
  {
    number: 9,
    title: "Connect Polar webhooks and file storage",
    description: "Point Polar at your webhook endpoint and give R2 a public URL.",
    icon: Webhook,
    details: (
      <div className="space-y-2 text-[11px] text-muted-foreground">
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            Polar → Organization → Webhooks: add{" "}
            <code className={code}>https://your-domain.com/api/webhooks/polar</code> and copy its secret into Admin →
            API Keys → Polar → Webhook Secret. Turn off Sandbox mode for live payments.
          </li>
          <li>
            Cloudflare → R2 → your bucket → Settings: enable the public r2.dev URL or connect a custom domain, then
            enter it as the <strong>Public bucket URL</strong> in Admin → API Keys and press{" "}
            <strong>Test connection</strong>.
          </li>
        </ul>
      </div>
    ),
  },
];

export default function AdminDeploymentPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Deployment</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Step-by-step guide to deploy your app on Vercel</p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.number} className="border border-border/40 bg-card/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground/70">STEP {step.number}</span>
                </div>
                <p className="text-xs font-semibold mt-0.5">{step.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </div>
            <div className="p-4 pt-3">{step.details}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
