# library Domain directory

Split folders by **Component role**. Avoid all. Flatten JSX to single layer.

| Directory | Content | No files added. |
|------|--------|----------|
| **shell/** | Generic Shell:`BookCard`、`BookListRow` | Business onClickList data |
| **actions/** | Card button factory: `read` / `translate` | UI Layout |
| **display/** | Cover hookLogo | Page layout |
| **page/** | Bookshelf: grid, toolbarfilter, viewPort | Detail/Collection popup |
| **categories/** | Collection tab | Bookshelf grid |
| **detail/** | Detail container + store + hooks | Card shell |
| **detail/shell/** | `BookDetailShell`（Dialog Toggle / Two-column slot） | Business Logic |
| **detail/panels/** | Fine-grained blocks (cover, title form, translation workbenchâ¦) | Tab assembly |
| **detail/tabs/** | Three Tab components + Tab Navigation shell | Field API |
| **detail/use-book-detail-*.js** | live item / document / translate hooks | UI Component |
| **domain/** | `controller` Translation/Delete/Inbound/Silent progress trackingâ¦ | Pure UI |

### Progress entry contract (confusable)

| Method | Provider | What it does |
|------|--------|--------|
| `selectJob(jobId)` | recent-jobs actions | **Open workflow modal** + Start polling |
| `attachJobProgress(jobId)` | **library domain/controller** | **Only** start polling, accept incoming. statusCardStoreRemove popup. Disable main status area. |

Book Details "Translation" Tab only uses `attachJobProgress`.

For external use `import { … } from "./features/library/index.js"`。

```text
App
 └─ page/RecentJobsLibrary
       └─ shell/BookCard  +  actions/*
             └─ open → detail/BookDetailDialog(container)
                      └─ shell/BookDetailShell
                           ├─ left:  CoverActionsPanel
                           └─ right: BookDetailRightTabs
                                ├─ BookDetailOverviewTab   Book Description
ââ BookDetailTranslateTab  Translation
                                └─ BookDetailMoreTab       Other Operations (including placeholder)
```
