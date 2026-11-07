# Crypto Risk Tools

Four free risk management tools built by [Crypto Renegades](https://www.cryptorenegades.co/). Education only. Not financial advice.

| Page | File | Search query it is built around | Links to |
| --- | --- | --- | --- |
| Crypto Position Size Calculator | `index.html` | crypto position size calculator | https://www.cryptorenegades.co/tools/position-size-calculator/ |
| Drawdown Recovery Calculator and Table | `drawdown-recovery-calculator.html` | drawdown recovery calculator (how much do I need to gain to recover from a drawdown) | https://www.cryptorenegades.co/glossary/drawdown/ |
| Crypto Risk Per Trade Table | `risk-per-trade-table.html` | crypto risk per trade table | https://www.cryptorenegades.co/glossary/risk-per-trade/ |
| Risk Reward Ratio Calculator | `risk-reward-ratio-calculator.html` | risk reward ratio calculator | https://www.cryptorenegades.co/blog/risk-reward-filter/ |

Plain HTML, CSS and JavaScript. Nothing to install and no build step. The pages make no outside requests: no fonts, no analytics, no cookies. Every calculator keeps its numbers in the page address, so a visitor can share a result by copying the link.

## What is in this folder

```
index.html                          Position size calculator (the home page)
drawdown-recovery-calculator.html   Drawdown recovery calculator, chart and table
risk-per-trade-table.html           Risk per trade table and losing streak table
risk-reward-ratio-calculator.html   Risk reward ratio calculator and break-even table
404.html                            Page shown for any address that does not exist
sitemap.xml                         List of the four pages for search engines
robots.txt                          Tells search engines where the sitemap is
.nojekyll                           Tells GitHub Pages to serve the files as they are
assets/css/site.css                 All styles (light and dark mode, print styles)
assets/js/calc.js                   All the math, in one tested file
assets/js/views.js                  What each tool shows for a given input
assets/js/app.js                    Connects the forms to the math
assets/img/                         Icons and the four social sharing images
README.md                           This file
```

The `.nojekyll` file starts with a dot, so your computer may hide it. Keep it: copy the whole folder, not just the files you can see.

## Step 1. Replace the placeholder (before you publish)

The pages, `sitemap.xml` and `robots.txt` use this placeholder for the live address:

```
cryptorenegades
```

Replace it everywhere with your GitHub username, exactly as it appears in your profile address. Example: if your profile is `github.com/cryptorenegades`, the site will live at `https://cryptorenegades.github.io/crypto-risk-tools/`.

The easy way: open this folder in VS Code (free), press Ctrl+Shift+H (Cmd+Shift+H on a Mac), type `cryptorenegades` in the search box, type your username in the replace box, and click **Replace All**. It appears in 7 files: the 4 tool pages, `404.html`, `sitemap.xml` and `robots.txt`.

If you name the repository anything other than `crypto-risk-tools`, also replace `crypto-risk-tools` in those same 7 files with the name you chose.

## Step 2. Create the repository on GitHub

1. Sign in at https://github.com.
2. Click **+** at the top right, then **New repository**.
3. Repository name: `crypto-risk-tools`.
4. Description: `Free crypto position size, drawdown, risk per trade and risk reward tools.`
5. Choose **Public**. GitHub Pages on a free account needs a public repository.
6. Leave "Add a README", ".gitignore" and "license" unticked. This folder already has a README.
7. Click **Create repository**.

## Step 3. Upload the files with GitHub Desktop

1. Install GitHub Desktop from https://desktop.github.com and sign in with the same GitHub account.
2. Choose **File > Clone repository**, pick `crypto-risk-tools`, choose where to save it, and click **Clone**.
3. Copy everything inside this folder into the cloned `crypto-risk-tools` folder, including `assets` and `.nojekyll`. The `.html` files must sit at the top level of the repository, not inside a subfolder.
4. In GitHub Desktop the files appear as changes. In the **Summary** box type `Publish Crypto Risk Tools`, then click **Commit to main**.
5. Click **Publish branch** (or **Push origin** if the button says that).

## Step 4. Turn on GitHub Pages

1. On github.com, open the `crypto-risk-tools` repository.
2. Go to **Settings**, then **Pages** in the left menu.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
5. Wait one to five minutes and refresh. The page shows "Your site is live at https://cryptorenegades.github.io/crypto-risk-tools/". Open it and click through all four tools.

Quick checks once it is live:

- Open `https://cryptorenegades.github.io/crypto-risk-tools/sitemap.xml`. It should list four addresses that start with your username, not the placeholder.
- Open a made-up address such as `.../crypto-risk-tools/test/`. You should see the styled "This page does not exist" page.

## Step 5. Submit the sitemap to Google Search Console

1. Go to https://search.google.com/search-console and click **Add property**.
2. Choose **URL prefix** (not Domain) and enter `https://cryptorenegades.github.io/crypto-risk-tools/` with your username.
3. Pick the **HTML tag** verification method. Copy the `<meta name="google-site-verification" ...>` tag Google shows you and paste it into the `<head>` of `index.html`, on a new line right under the `<title>` line. Commit and push in GitHub Desktop, wait a minute, then click **Verify**.
4. In the new property, open **Sitemaps**, enter `sitemap.xml`, and click **Submit**.
5. Optional: paste each page address into **URL inspection** at the top and click **Request indexing**.

## Step 6. Submit the sitemap to Bing Webmaster Tools

1. Go to https://www.bing.com/webmasters and sign in.
2. If Google Search Console is already verified, choose **Import** to bring the site in with one click. Otherwise choose **Add your site manually**, enter the same address, and verify with the **HTML Meta Tag** method the same way as Step 5.
3. Open **Sitemaps**, click **Submit sitemap**, and enter `https://cryptorenegades.github.io/crypto-risk-tools/sitemap.xml` with your username.

Bing's index also feeds several AI answer engines, so this step is worth the two minutes.

## Making changes later

Text changes can be made directly in the `.html` files. Keep these rules for every word, as the rest of the site does: no em dashes or en dashes, no exchange or wallet brand names, no promises of results or profit claims, and "Education only. Not financial advice." stays on every page.

The pages were generated from a script, and the math has automated tests. Both live next to this folder in `dev-v2/` (`build.js` writes the pages, `calc.test.js` tests every formula, `copy-lint.mjs` checks the copy rules, `shoot.js` checks layout in a real browser). A developer can change a tool there and rebuild, which keeps all four pages consistent. If you edit the HTML by hand instead, those edits are lost the next time someone runs the script.

When you change anything, update the `<lastmod>` dates in `sitemap.xml` so search engines know to look again.
