This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Origin Trial (Chrome Built‑in AI)

If you plan to use Chrome’s Built‑in AI APIs from the web app (not the extension), you can enable an Origin Trial token via an HTTP header. Support is already wired in `next.config.js`:

1. Obtain an Origin Trial token for the feature from Chrome’s Origin Trials.
2. Create `.env.local` at the project root and set:
   
   ```env
   ORIGIN_TRIAL_TOKEN=your_token_here
   ```
3. Start the dev server. The app will send `Origin-Trial: <token>` for all routes.
4. Verify in DevTools → Network tab → any request → Headers.

Note: The Chrome extension does not require Origin Trials; it accesses Built‑in AI directly within the extension context when available on the device.
