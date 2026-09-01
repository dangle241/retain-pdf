// GlossariesDialog(React 版 <glossary-manager-dialog>,对照
// components/dialogs/glossary-manager-dialog-template.js 逐 id 镜像 +
// features/glossaries/controller.js(kept 控制器)的开合/读取/保存编排)。
//
// Dialog 渲染层(阶段 C,shadcn 改造):从原生 <dialog>+showModal/close 换成
// radix-ui 的 Dialog 原语(DialogPrimitive.Root/Portal/Overlay/Content),不经
// src/components/ui/dialog.jsx 那层默认皮肤(className 继续用现有的
// desktop-dialog/desktop-shell/glossary-manager-* 这套 bespoke CSS)。open 受控
// 于 glossariesDialogStore(useGlossariesController 的 open),onOpenChange 在
// next===false 时统一调用 dialogStore.close()——Escape、点击背板、点击关闭
// 按钮三条路径都走这一个回调,不再需要手写 handleBackdropClick/keydown 监听。
//
// 不 forceMount Content/Overlay(同 CredentialsDialog.jsx 头注释的结论):Radix
// modal Content 内部 hideOthers(content) 的 effect 依赖真实 mount/unmount
// 生命周期,forceMount 会让它在对话框从未打开时就永久生效,制造新的无障碍
// 缺陷。词表列表/编辑器的字段都受控于 glossariesStore(非本组件本地状态),
// 对话框关闭时 Content 卸载不会丢数据——controller.js 的 open() 在重新打开时
// 会 reloadGlossaries() 回填,语义不变。
//
// 打开入口:SettingsHubDialog"词表"tab 的 #glossary-btn 调用
// services.glossaries.dialogStore.open()(蓝图 §0.4);本组件内部的 open 状态
// 迁移 effect(见 useGlossariesController.js)把这次打开接回 controller.js 的
// open(),补上"打开即刷新列表"的旧语义。

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import { useGlossariesController } from "./useGlossariesController.js";
import { GlossaryList } from "./GlossaryList.jsx";
import { GlossaryEditor } from "./GlossaryEditor.jsx";
import { GlossaryImportPanel } from "./GlossaryImportPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size 在未注解源文件里被推断为必填;unstyled 路径运行时不用 size。
const Button = ButtonBase as any;

export function GlossariesDialog() {
  const { open, view, store: glossariesStore, dialogStore, handlers } = useGlossariesController();
  // view.store 在 HomeServices 上仍是 AppStore 默认泛型；运行时 actions 齐全
  const store = glossariesStore as unknown as {
    actions: {
      setName: (name: string) => unknown;
      updateEntryField: (payload: { index: number; field: string; value: unknown }) => unknown;
      removeEntryRow: (index: number) => unknown;
      setCsvText: (value: string) => unknown;
    };
  };
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const status = view.status || { message: "", tone: "" };
  const statusContent = `${status.message || ""}`.trim();
  const statusClasses = [
    "upload-status",
    statusContent ? "" : "hidden",
    status.tone === "valid" ? "is-valid" : "",
    status.tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={GLOSSARY_DOM_IDS.dialog}
          className="desktop-dialog glossary-manager-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell glossary-manager-shell">
            <div className="desktop-head">
              <div className="credential-dialog-head">
                <DialogPrimitive.Title asChild>
                  <h2>术语表</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  id={GLOSSARY_DOM_IDS.closeButton}
                  className="dialog-close-btn"
                  aria-label="关闭"
                >
                  ×
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body glossary-manager-body">
              <GlossaryList
                items={view.items}
                selectedId={view.selectedId}
                onSelect={(glossaryId) => handlers?.selectGlossary?.(glossaryId)}
                onCreateNew={() => handlers?.createNew?.()}
              />

              <section className="glossary-editor-panel">
                <label className="glossary-name-field">
                  <span>名称</span>
                  <input
                    id={GLOSSARY_DOM_IDS.nameInput}
                    type="text"
                    autoComplete="off"
                    placeholder="例如 量子化学术语"
                    value={view.draft.name}
                    onChange={(event) => store.actions.setName(event.target.value)}
                  />
                </label>
                <div className="glossary-toolbar">
                  <Button id={GLOSSARY_DOM_IDS.addRowButton} className="app-button secondary" onClick={() => handlers?.addRow?.()}>添加</Button>
                  <Button id={GLOSSARY_DOM_IDS.importButton} className="app-button secondary" onClick={() => handlers?.showImport?.()}>CSV</Button>
                  <Button id={GLOSSARY_DOM_IDS.exportButton} className="app-button secondary" onClick={() => handlers?.exportCurrent?.()}>导出</Button>
                  <Button id={GLOSSARY_DOM_IDS.deleteButton} className="app-button secondary danger" onClick={() => handlers?.deleteCurrent?.()}>删除</Button>
                </div>
                <div className="glossary-editor-scroll">
                  <GlossaryEditor
                    entries={view.draft.entries}
                    onFieldChange={(index, field, value) => store.actions.updateEntryField({ index, field, value })}
                    onRemoveRow={(index) => store.actions.removeEntryRow(index)}
                  />
                  <GlossaryImportPanel
                    visible={view.importVisible}
                    csvText={view.csvText}
                    onCsvTextChange={(value) => store.actions.setCsvText(value)}
                    onApply={() => handlers?.applyImport?.()}
                    onCancel={() => handlers?.hideImport?.()}
                  />
                </div>
                <div className="glossary-footer">
                  <span id={GLOSSARY_DOM_IDS.status} className={statusClasses}>{statusContent}</span>
                  <Button id={GLOSSARY_DOM_IDS.saveButton} className="app-button" onClick={() => handlers?.save?.()}>保存</Button>
                </div>
              </section>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
