import { build, context } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const outdir = path.join(frontendRoot, "dist");

// --watch: context esbuild tái dựng tăng dần (chế độ phát triển: bật sourcemap, tắt minify)
const watchMode = process.argv.includes("--watch");

// Đường dẫn import vẫn dùng .js/.jsx để tương thích import hiện có; khi phân giải sẽ ánh xạ sang .ts/.tsx.
// Quy ước bundler TypeScript: import "./foo.js" có thể trỏ tới foo.ts.
function jsToTsResolvePlugin() {
  const map = new Map([
    [".js", [".ts", ".tsx", ".js"]],
    [".jsx", [".tsx", ".jsx"]],
    [".mjs", [".mts", ".mjs"]],
  ]);
  return {
    name: "js-to-ts-resolve",
    setup(buildApi) {
      buildApi.onResolve({ filter: /\.(jsx?|mjs)$/ }, (args) => {
        if (args.namespace !== "file" && args.namespace !== "") return;
        if (args.path.startsWith("http") || args.path.startsWith("data:")) return;
        const candidates = map.get(path.extname(args.path));
        if (!candidates) return;

        let dir = args.resolveDir;
        if (args.importer) {
          dir = path.dirname(args.importer);
        }
        const absBase = path.isAbsolute(args.path)
          ? args.path
          : path.join(dir, args.path);
        const withoutExt = absBase.replace(/\.(jsx?|mjs)$/, "");
        for (const ext of candidates) {
          const candidate = `${withoutExt}${ext}`;
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return { path: candidate };
          }
        }
        return undefined;
      });
    },
  };
}

// Bảng entry đóng gói riêng cho ba trang MPA: home/detail/reader đều đã chuyển sang React.
const PAGE_BUNDLES = [
  {
    name: "home",
    entry: path.join(frontendRoot, "src/pages/home/entry.tsx"),
    outfile: path.join(outdir, "app.bundle.js"),
  },
  {
    name: "detail",
    entry: path.join(frontendRoot, "src/pages/detail/entry.tsx"),
    outfile: path.join(outdir, "detail.bundle.js"),
  },
  {
    name: "reader",
    entry: path.join(frontendRoot, "src/pages/reader/entry.tsx"),
    outfile: path.join(outdir, "reader.bundle.js"),
  },
];

// mathjax-full/js/components/version.js sẽ thực hiện thao tác sau khi PACKAGE_VERSION chưa được định nghĩa:
// eval('require') để đọc package.json; thao tác này lỗi ngay trong ESM của trình duyệt và khiến mọi công thức phải dùng phương án dự phòng.
function resolveMathJaxPackageVersion() {
  try {
    const pkgPath = path.join(
      frontendRoot,
      "node_modules/mathjax-full/package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "3.2.1";
  } catch {
    return "3.2.1";
  }
}

function bundleOptions({ entry, outfile }) {
  return {
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    alias: {
      "@": path.join(frontendRoot, "src"),
    },
    plugins: [jsToTsResolvePlugin()],
    define: {
      PACKAGE_VERSION: JSON.stringify(resolveMathJaxPackageVersion()),
    },
    loader: {
      ".html": "text",
      ".ts": "ts",
      ".tsx": "tsx",
    },
    minify: !watchMode,
    sourcemap: watchMode ? "inline" : false,
    logLevel: "info",
    legalComments: "none",
  };
}

// Chỉ xóa đầu ra JS và giữ dist/css/ (build:css ghi riêng; xóa cả thư mục sẽ làm mất CSS trang chính).
fs.mkdirSync(outdir, { recursive: true });
for (const page of PAGE_BUNDLES) {
  try {
    fs.rmSync(page.outfile, { force: true });
  } catch {
    // ignore
  }
}

if (watchMode) {
  const contexts = await Promise.all(
    PAGE_BUNDLES.map((page) => context(bundleOptions(page))),
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log(`[watch] Đang theo dõi: ${PAGE_BUNDLES.map((p) => p.name).join(", ")} (Ctrl+C để thoát)`);
} else {
  for (const page of PAGE_BUNDLES) {
    await build(bundleOptions(page));
  }
}
