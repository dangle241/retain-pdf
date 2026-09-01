# Check if CSS variables suffice. If yes, define `:root` overrides in new `.css`. No JS needed. If dynamic switching required, toggle class on `<html>`. Avoid complex theming engines unless multiple simultaneous themes needed. YAGNI.

Goal: scale themes later.**Move only 3 places**without touching business components.

---

## Steps (approx 10 minutes)

### 1. Write CSS Skin file

Copy template:

```bash
cp frontend/src/styles/themes/classic.css \
   frontend/src/styles/themes/<id>.css
```

Edit to:

```css
/* Skin <id>: one-line description */
[data-theme="<id>"] {
  --bg: …;
  --paper: …;
  --surface: …;
  --ink: …;
  --muted: …;
  --line: …;

  --accent: …;
  --accent-weak: …;
  --selection: …;

  --danger: …;
  --danger-weak: …;
  --ok: …;
  --ok-weak: …;
  --warn: …;
  --warn-weak: …;

  --gold: …;
  --gold-weak: …;
  --chrome: …;
  --reader-page: …;
}
```

**Required variable** see `frontend/src/styles/themes/_contract.css`.

Note:

- Primary button text uses `var(--paper)` Stacked on `var(--accent)` Up. Ensure contrast.
- Dark skin:`group: "dark"`，`--ink` Light text.`--bg` Deep bottom.

### 2. Integrate into build

`frontend/src/styles/themes/index.css` Add one line:

```css
@import "./<id>.css";
```

### 3. Register

`frontend/src/shared/theme/registry.ts`'s `THEME_REGISTRY` Append to array:

```ts
{
  id: "<id>",
  label: "Display Name",
  description: "Sentence.",
  group: "light" | "dark" | "accent",
  order: 50, // Sort
  preview: {
    bg: "#……",
    paper: "#……",
    accent: "#……",
    ink: "#……",
    danger: "#……",
  },
},
```

`preview` Settings page color blocks only.**Please match CSS Primary color consistent.**。

### 4. Build

```bash
cd frontend && npm run build:css && npm run build:js
```

### 5. Verify

```js
localStorage.setItem("retainpdf.theme", "<id>");
location.reload();
// Or Settings â Appearance Click
```

---

## Prohibited items

| Don't | Reason |
|------|------|
| Write in component. `if (theme === 'xxx')` Change Color | Use CSS variables |
| In business CSS Hardcode `#1d1d1f` | Use `var(--ink)` |
| Change shadcn Variable name | Modify underlying layer only. `--accent` etc. |
| Forget. index.css import | Skin not applied. dist |

---

## Optional enhancements

- Design notes:`docs/theme-system/skins/<id>.md`
- Listen for theme changes:`window.addEventListener('retainpdf:theme-change', …)`
- Dark theme exceptions: `html.theme-dark` or `[data-theme-group="dark"]`

---

## Checklist

- [ ] `themes/<id>.css` Include all required token  
- [ ] `themes/index.css` imported
- [ ] `registry.ts` Registered and preview Align  
- [ ] Primary button / Selected tab Readable under this skin.  
- [ ] `npm run build:css` passed
