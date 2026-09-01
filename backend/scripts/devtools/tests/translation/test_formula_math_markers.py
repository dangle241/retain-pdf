import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.layout.inline_content.core.markdown import build_markdown_from_direct_text
from services.rendering.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from services.rendering.layout.inline_content.fallback.placeholder_markdown import build_markdown_from_parts
from services.rendering.layout.inline_content.fallback.placeholder_markdown import formula_map_lookup
from services.rendering.layout.inline_content.fallback.placeholder_markdown import split_protected_text
from services.rendering.layout.inline_content.fallback.png_renderer import convert_latexish_to_typst
from services.rendering.layout.inline_content.core.inline_math import build_direct_typst_passthrough_markdown
from services.rendering.layout.inline_content.core.inline_math import sanitize_direct_typst_inline_math
from services.rendering.layout.inline_content.mode_router import build_item_render_markdown
from services.rendering.layout.inline_content.mode_router import build_render_markdown
from services.rendering.layout.inline_content.mode_router import is_direct_typst_math_mode
from services.rendering.layout.inline_content.mode_router import item_render_math_mode


def test_typst_markdown_supports_typed_formula_placeholders() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"(\mathrm{CaO}_2)"}]
    markdown = build_markdown_from_parts("Calcium peroxide<f1-17a/>Release", formula_map)
assert markdown == r"Calcium peroxide $(\mathrm{CaO}_2)$ release"


def test_typst_markdown_supports_direct_math_text_without_formula_map() -> None:
    markdown = build_markdown_from_direct_text(r"Transfer matrixQ_tindicates, andx_t∈{0,1}^K。")
    assert markdown == r"Transition MatrixQ_tindicate, andx_t∈{0,1}^K。"


def test_render_markdown_defaults_to_placeholder_mode() -> None:
    assert item_render_math_mode({}) == "placeholder"
    assert not is_direct_typst_math_mode({})


def test_render_markdown_uses_direct_typst_path_for_item() -> None:
    item = {"math_mode": "direct_typst"}
    markdown = build_item_render_markdown(item, r"Points$\int f(x) dx$value", [])
assert markdown == r"Integral $\int f(x) dx$ value"


def test_direct_typst_render_markdown_does_not_rewrite_latex_cite_commands() -> None:
    item = {"math_mode": "direct_typst"}
    markdown = build_item_render_markdown(
        item,
r"ACONF\cite{124}, PCONF21\cite{117,126,127} and GMTKN55 \citep{117}",
        [],
    )
    assert r"ACONF\cite{124}" in markdown
    assert r"PCONF21\cite{117,126,127}" in markdown
    assert r"GMTKN55 \citep{117}" in markdown


def test_render_markdown_uses_formula_map_for_placeholder_mode() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    markdown = build_render_markdown("Hello<f1-17a/>, next", formula_map, math_mode="placeholder")
assert markdown == r"Hello $\pi$, next step"


def test_placeholder_boundary_helpers_preserve_token_splitting_and_lookup() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
    assert formula_map_lookup(formula_map) == {"<f1-17a/>": r"\pi"}
assert split_protected_text("Hello<f1-17a/>, next step") == ["Hello", "<f1-17a/>", ", next step"]


def test_typst_markdown_direct_typst_conservative_mode_does_not_guess_plain_scripts() -> None:
markdown = build_markdown_from_direct_text(r"The transition matrix Q_t indicates that, and x_tâ{0,1}^K.")
    assert "$Q_t$" not in markdown
    assert "$x_t$" not in markdown
    assert "Q_t" in markdown
    assert "x_t" in markdown


def test_typst_markdown_direct_typst_conservative_mode_keeps_raw_latex_text() -> None:
    markdown = build_markdown_from_direct_text(r"ion is \left[ NTf _ { 2 } \right] , and forms the \mathrm { Co(IV) } Species.")
    assert r"$\left[" not in markdown
    assert r"$\mathrm" not in markdown
    assert r"\left[ NTf _ { 2 } \right]" in markdown
    assert "Co(IV)" in markdown


def test_typst_markdown_direct_text_does_not_rewrite_latex_cite() -> None:
    markdown = build_markdown_from_direct_text(
r"The set ACONF\cite{124} and PCONF21\cite{117,126,127}.",
    )
    assert r"ACONF\cite{124}" in markdown
    assert r"PCONF21\cite{117,126,127}" in markdown
    assert "¹²⁴" not in markdown


def test_typst_markdown_direct_typst_keeps_existing_inline_math_latex() -> None:
    markdown = build_markdown_from_direct_text(
        r"Observed. $\mathrm{Ph(i-PrO)SiH_2}$ (6) Consumes faster than other silanes.",
        normalize_existing_inline_math=True,
    )
    assert r"$\mathrm{Ph(i-PrO)SiH_2}$" in markdown


def test_typst_markdown_direct_typst_keeps_existing_left_right_inline_math_latex() -> None:
    markdown = build_markdown_from_direct_text(
        r"formed $\left(\mathrm{Ph}\left(i-\mathrm{PrO}\right)_2\mathrm{Si}\right)_2\mathrm{O}$ Species.",
        normalize_existing_inline_math=True,
    )
    assert r"\left" in markdown
    assert r"\right" in markdown
    assert "$" in markdown


def test_direct_typst_passthrough_keeps_short_latex_text_subscripts_atomic() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"Outside Influence Set ($v_{\text{ext}}, \mathbf{B}_{\text{ext}}$) Mapping between."
    )

    assert r"v_{\text{ext}}, \mathbf{B}_{\text{ext}}" in markdown
    assert r"$v_{$" not in markdown
    assert r"\mathbf{B}_{$" not in markdown


def test_direct_typst_passthrough_keeps_adjacent_short_latex_text_subscripts_atomic() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"Potential field groups:$v_{\text{ext}}, A_{\text{ext}}$和$v_{\text{ext}}^{\prime}, A_{\text{ext}}^{\prime}$。"
    )

    assert r"$v_{\text{ext}}, A_{\text{ext}}$" in markdown
    assert r"$v_{\text{ext}}^{\prime}, A_{\text{ext}}^{\prime}$" in markdown
    assert r"$v_{$" not in markdown
    assert r"A_{$" not in markdown


def test_direct_typst_passthrough_does_not_demote_formula_text_blocks() -> None:
    markdown = build_direct_typst_passthrough_text(
r"Where $x^{\text{this is intentionally long text inside math}} + y$ Keep model output."
    )

    assert r"$x^{\text{this is intentionally long text inside math}} + y$" in markdown
    assert "intentionally long text inside math $" not in markdown


def test_typst_markdown_escapes_literal_double_asterisk_in_plain_text() -> None:
markdown = build_markdown_from_direct_text(r"Using 6-310** Basis set and corresponding optimized geometry calculation.")
    assert r"6-310\*\*" in markdown


def test_direct_typst_passthrough_escapes_literal_double_asterisk_outside_math() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"Usage 6-310** Basis set, retained. $E=mc^2$ Unchanged."
    )
    assert r"6-310\*\*" in markdown
    assert r"$E=mc^2$" in markdown


def test_direct_typst_passthrough_preserves_markdown_italic_outside_math() -> None:
    markdown = build_direct_typst_passthrough_text(
r"Derived from German *Farbe* and preserve $C_{3\nu}$ unchanged."
    )
    assert r"*Farbe*" in markdown
    assert r"\*Farbe\*" not in markdown
    assert r"$C_{3\nu}$" in markdown


def test_build_markdown_from_parts_direct_typst_passthrough() -> None:
    markdown = build_direct_typst_passthrough_text(
r"Observed that the consumption rate of $\mathrm{Ph(i-PrO)SiH_2}$ (6) is faster than that of other silanes."
    )
assert markdown == r"Observed that the consumption rate of $\mathrm{Ph(i-PrO)SiH_2}$ (6) is faster than other silanes."


def test_typst_markdown_keeps_spaces_around_inline_math() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"\pi"}]
markdown = build_markdown_from_parts("Hello<f1-17a/>, next step", formula_map)
assert markdown == r"Hello $\pi$, next step"


def test_typst_markdown_adds_spaces_between_cjk_text_and_inline_math() -> None:
    markdown = build_direct_typst_passthrough_text(r"integral$\int f(x) dx$value")
assert markdown == r"Integral $\int f(x) dx$ value"


def test_direct_typst_passthrough_keeps_existing_inline_math_latex_shape() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"$ \mathbf{f}_{\alpha}^{IJ}(\mathbf{R}) $ Understands monostate. Born-Oppenheimer Key to approximation limitations."
    )
    assert markdown.startswith(r"$\mathbf{f}_{\alpha}^{IJ}(\mathbf{R})$ Understood.")


def test_direct_typst_passthrough_normalizes_angle_expectation_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
r"where $ \langle S^{2}\rangle_{T_{1}} $ and $ \langle S^{2}\rangle_{BS} $ respectively $ T_{1} $ state."
    )

    assert r"$⟨S^{2}⟩_{T_{1}}$" in markdown
    assert r"$⟨S^{2}⟩_{BS}$" in markdown
    assert r"$T_{1}$" in markdown


def test_direct_typst_passthrough_normalizes_bare_angle_expectation_for_mitex() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"表1. $ \langle\Delta E_{ST}\rangle $Unit:eV）。"
    )

    assert r"$⟨\Delta E_{ST}⟩$" in markdown
    assert r"\langle" not in markdown
    assert r"\rangle" not in markdown


def test_direct_typst_passthrough_separates_adjacent_inline_math_blocks() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"Related to the damping function.$^{86}$$a_{n}$ Adjusted global parameters."
    )
assert r"$^{86}$ $a_{n}$ is the adjusted global parameter." in markdown
    assert "$$a" not in markdown


def test_direct_typst_passthrough_wraps_parenthesized_inline_math_boundary() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"while $R_{0}^{AB} = 0.5$ ($R_{0}^{A'} + R_{0}^{B'}$) Determine damping."
    )
assert r"while $R_{0}^{AB} = 0.5$ $(R_{0}^{A'} + R_{0}^{B'})$ determines damping." == markdown


def test_direct_typst_passthrough_does_not_wrap_cjk_parenthesized_inline_math() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"$ w_j $ Integral weight from grid points. $j$（$ j \in [1, 23] $Obtained by trapezoidal segmentation between )."
    )
    assert r"$j$$（" not in markdown
assert r"$w_j$ is the integration weight, obtained by trapezoidal partition between grid points $j$ ($j \in [1, 23]$)." == markdown


def test_direct_typst_passthrough_normalizes_display_math_delimiters() -> None:
    markdown = build_direct_typst_passthrough_text(
        r"$$ \delta E _{ \mathrm{c} }^{ \mathrm{MP2} }/ \delta\phi_{k}^{\dagger}(\boldsymbol{r}) $$ Decay Rate"
    )
    assert "$ $" not in markdown
assert r"the decay rate of $\delta E _{ \mathrm{c} }^{ \mathrm{MP2} } / \delta\phi_{k}^{\dagger}(\boldsymbol{r})$" == markdown


def test_convert_latexish_to_typst_splits_attached_angle_command() -> None:
    assert convert_latexish_to_typst(r"\angleCSH") == "angle CSH"


def test_direct_typst_passthrough_rewrites_mathscr_for_mitex_compatibility() -> None:
    markdown = build_direct_typst_passthrough_text(r"$\mathscr{P}$ Space")
    assert markdown == r"$\mathcal{P}$ Space"


def test_direct_typst_sanitizer_keeps_only_inline_math_compat_cleanup() -> None:
markdown = sanitize_direct_typst_inline_math(r"body text $\mathscr{P}$ and $\angleABC$ keep")
assert markdown == r"body text $\mathcal{P}$ and $\angle ABC$ kept"


def test_direct_typst_sanitizer_normalizes_double_backslash_math_commands() -> None:
    markdown = sanitize_direct_typst_inline_math(r"concentration $2.5~\\mu\\text{g}~\\text{ml}^{-1}$ Keep")
assert markdown == r"concentration $2.5~\mu\text{g}~\text{ml}^{-1}$ kept"


def test_direct_typst_sanitizer_rewrites_unsupported_circled_command() -> None:
markdown = sanitize_direct_typst_inline_math(r"path $\circled{\times}$ and $\circled{A}$ kept")
assert markdown == r"path $\otimes$ and $A$ kept"


def test_direct_typst_sanitizer_rewrites_hbar_for_mitex_compatibility() -> None:
markdown = sanitize_direct_typst_inline_math(r"momentum operator $-i\hbar d/dq_k$ and $i\hbar d/dp_j$.")
    assert markdown == "动量算符 $-iℏ d/dq_k$ 和 $iℏ d/dp_j$。"


def test_direct_typst_sanitizer_rewrites_partial_for_mitex_compatibility() -> None:
    markdown = sanitize_direct_typst_inline_math(r"derivative $\partial E/\partial N = \mu$ maintained.")
assert markdown == r"derivative $â E/â N = \mu$ kept."


def test_direct_typst_sanitizer_rewrites_bra_ket_rangle_for_mitex_compatibility() -> None:
markdown = sanitize_direct_typst_inline_math(r"state $|k\rangle$ and $|0\rangle$ kept.")
assert markdown == r"state $|kâ©$ and $|0â©$ kept."


def test_direct_typst_sanitizer_rewrites_varphi_for_mitex_compatibility() -> None:
    # sanitizer Also strips. mitex Unsupported \left/\right Size modifier
markdown = sanitize_direct_typst_inline_math(r"ground state $\left|\varPhi_{0}\right\rangle$ kept.")
assert markdown == r"ground state $|\Phi_{0}â©$ kept."


def test_direct_typst_sanitizer_restores_spreadsheet_cell_pseudo_math() -> None:
    markdown = sanitize_direct_typst_inline_math(r"Bounding box input $\C\107$Variable box input $\B\3$。")
assert markdown == "Target box input C107, variable box input B3."


def test_direct_typst_boundary_module_matches_legacy_passthrough_behavior() -> None:
text = r"Use 6-310** base group, keep $E=mc^2$ and $\mathscr{P}$ keep"
    assert build_direct_typst_passthrough_markdown(text) == build_direct_typst_passthrough_text(text)


def test_typst_markdown_does_not_render_superscript_citation_as_unicode_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"^{6c}"}]
markdown = build_markdown_from_parts("Method<f1-17a/>Prompt", formula_map)
    assert "⁶ᶜ" not in markdown
    assert "6c" in markdown


def test_typst_markdown_does_not_compact_bracket_citation_text() -> None:
    formula_map = [{"placeholder": "<f1-17a/>", "formula_text": r"[35, 36]"}]
markdown = build_markdown_from_parts("See<f1-17a/>Next step", formula_map)
    assert "[35" in markdown
    assert "36]" in markdown


def test_typst_markdown_does_not_promote_bare_superscript_citation_by_default() -> None:
    markdown = build_markdown_from_parts("HerzonThe research group also used this condition.^{18}", [])
    assert markdown.endswith("。^{18}")


def test_typst_markdown_does_not_promote_bare_scripted_chemical_formula() -> None:
    text = "Co(III)(Sal^{tBu,tBu})(i - Pr) (4) React with intermediate."
    markdown = build_markdown_from_direct_text(text)
    assert markdown == text


def test_typst_markdown_does_not_promote_double_slash_latex_command_outside_math() -> None:
    markdown = build_markdown_from_direct_text(r"$\mathrm{Ni(II)}$-aryl/ \\mathrm{Co(IV)} -alkyl")
    assert r"$\mathrm{Ni(II)}$" in markdown
    assert r"\\mathrm{Co(IV)}" in markdown
    assert r"$\mathrm{Co(IV)}$" not in markdown


def test_typst_markdown_does_not_promote_left_right_bracket_formula() -> None:
markdown = build_markdown_from_direct_text(r"The ion is \left[ NTf _ { 2 } \right] with ligand.")
    assert r"$\left[ NTf" not in markdown
    assert r"\left[ NTf _ { 2 } \right]" in markdown


def test_typst_markdown_does_not_promote_bracketed_ion_pair() -> None:
    markdown = build_markdown_from_direct_text(r"solvent used [BMM][PF6] System.")
    assert markdown == r"Solvent Use [BMM][PF6] System."
