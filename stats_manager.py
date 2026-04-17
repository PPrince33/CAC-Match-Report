"""
CAC Match Report — Stats Manager
================================
Run this script with:   python3 stats_manager.py

Use the GUI to show/hide stats on each page and reorder them.
Changes are saved to  CAC-test-main/src/stats_config.json
Then rebuild the app:  cd CAC-test-main && npm run build
"""

import json
import os
import tkinter as tk
from tkinter import ttk, messagebox

# ─── Path to the config file ────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH  = os.path.join(SCRIPT_DIR, "CAC-test-main", "src", "stats_config.json")

# ─── Human-readable names for every stat ID ─────────────────────────────────
STAT_LABELS = {
    # Summary
    "summary_possession":            "Possession %",
    "summary_xg":                    "Expected Goals (xG)",
    "summary_shots_sot":             "Shots (Shots on Target)",
    "summary_pass_accuracy":         "Pass Accuracy (Total Passes)",
    "summary_fouls":                 "Disciplined Play (Fouls)",
    # Attack – Shooting
    "attack_goals":                  "Goals",
    "attack_shots_on_target":        "Total Shots (On Target)",
    "attack_shots_inside_box":       "Shots Inside Box",
    "attack_shots_outside_box":      "Shots Outside Box",
    "attack_avg_shot_distance":      "Avg Shot Distance (m)",
    "attack_xg":                     "Expected Goals (xG)",
    "attack_xg_per_shot":            "xG Per Shot",
    "attack_xg_overperformance":     "xG Overperformance",
    # Attack – Distribution
    "attack_assists":                "Assists",
    "attack_key_passes":             "Key Passes",
    "attack_total_passes":           "Total Passes (Accuracy %)",
    "attack_progressive_passes":     "Progressive Passes",
    "attack_through_balls":          "Through Balls",
    "attack_crosses":                "Crosses",
    # Attack – Ball Progression
    "attack_total_carries":          "Total Carries",
    "attack_progressive_carries":    "Progressive Carries",
    "attack_carries_final_third":    "Carries into Final 3rd",
    "attack_dribbles":               "Dribbles (Success %)",
    # Attack – Pressure
    "attack_shots_under_pressure":   "Shots Under Pressure",
    "attack_pass_acc_under_pressure":"Pass Accuracy Under Pressure",
    # Defense – Tackling
    "defense_total_tackles":              "Total Tackles (Success %)",
    "defense_tackles_succ_failed":        "Tackles: Successful / Failed",
    "defense_tackles_gaining_poss":       "Tackles Gaining Possession",
    "defense_total_interceptions":        "Total Interceptions",
    "defense_interceptions_succ_failed":  "Interceptions: Successful / Failed",
    "defense_ints_gaining_poss":          "Interceptions Gaining Possession",
    # Defense – Blocks
    "defense_total_blocks":               "Total Blocks (Successful)",
    "defense_opp_shots_blocked":          "Opponent Shots Blocked",
    "defense_total_clearances":           "Total Clearances (Successful)",
    "defense_clearances_gaining_poss":    "Clearances Gaining Possession",
    "defense_own_goals":                  "Defensive Own Goals",
    # Defense – Work Rate
    "defense_total_defensive_actions":    "Total Defensive Actions",
    "defense_defensive_success_rate":     "Defensive Success %",
    "defense_possession_wins":            "Possession Wins",
    "defense_total_ball_recoveries":      "Total Ball Recoveries",
    "defense_total_pressures":            "Total Pressures",
    # Defense – Goalkeeping
    "defense_total_saves":                "Total Saves",
    "defense_gripping_push_saves":        "Gripping / Push Saves",
    "defense_total_fouls":                "Total Fouls (incl. Pressing Fouls)",
    "defense_yellow_red_cards":           "Yellow / Red Cards",
}

# Section display names and which config key they map to
SECTIONS = [
    # (tab_label, section_header, config_key)
    ("Summary",  "Summary Stats",                   "summary"),
    ("Attack",   "Shooting & Efficiency",            "attack_shooting"),
    ("Attack",   "Distribution & Creativity",        "attack_distribution"),
    ("Attack",   "Ball Progression",                 "attack_ball_progression"),
    ("Attack",   "Performance Under Pressure",       "attack_pressure"),
    ("Defense",  "Tackling & Interceptions",         "defense_tackling"),
    ("Defense",  "Blocks & Clearances",              "defense_blocks"),
    ("Defense",  "Work Rate & Recoveries",           "defense_work_rate"),
    ("Defense",  "Goalkeeping & Discipline",         "defense_goalkeeping"),
]


def load_config():
    if not os.path.exists(CONFIG_PATH):
        messagebox.showerror("File Not Found",
            f"Could not find stats_config.json at:\n{CONFIG_PATH}\n\n"
            "Make sure you run this script from the 'CAC Match Report' folder.")
        return None
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


# ─── Main Application ────────────────────────────────────────────────────────

class StatsManager(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CAC Match Report — Stats Manager")
        self.geometry("720x620")
        self.resizable(True, True)
        self.configure(bg="#f1f5f9")

        self.config_data = load_config()
        if self.config_data is None:
            self.destroy()
            return

        self._unsaved = False
        self._build_ui()

    # ── Build the full UI ───────────────────────────────────────────────────

    def _build_ui(self):
        # ── Top bar ──────────────────────────────────────────────────────────
        top = tk.Frame(self, bg="#000000", pady=10)
        top.pack(fill="x")
        tk.Label(top, text="CAC MATCH REPORT  ·  STATS MANAGER",
                 bg="#000000", fg="#FFD166",
                 font=("Courier", 14, "bold")).pack(side="left", padx=16)
        tk.Label(top,
                 text="Enable/disable stats • Move up/down to reorder",
                 bg="#000000", fg="#888888",
                 font=("Courier", 9)).pack(side="right", padx=16)

        # ── Notebook tabs ────────────────────────────────────────────────────
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TNotebook",          background="#f1f5f9", borderwidth=0)
        style.configure("TNotebook.Tab",      font=("Courier", 10, "bold"),
                         padding=[12, 6], background="#e2e8f0", foreground="#000000")
        style.map("TNotebook.Tab",
                  background=[("selected", "#FFD166")],
                  foreground=[("selected", "#000000")])

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=12, pady=8)

        # Group SECTIONS by tab label
        tabs = {}
        for tab_label, section_header, config_key in SECTIONS:
            if tab_label not in tabs:
                tabs[tab_label] = []
            tabs[tab_label].append((section_header, config_key))

        for tab_label, section_list in tabs.items():
            frame = tk.Frame(nb, bg="#f8fafc")
            nb.add(frame, text=f"  {tab_label.upper()}  ")
            self._build_tab(frame, section_list)

        # ── Bottom bar ───────────────────────────────────────────────────────
        bot = tk.Frame(self, bg="#e2e8f0", pady=8)
        bot.pack(fill="x", side="bottom")

        self.status_lbl = tk.Label(bot, text="No unsaved changes.",
                                   bg="#e2e8f0", fg="#666666",
                                   font=("Courier", 9))
        self.status_lbl.pack(side="left", padx=16)

        tk.Button(bot, text="RESET TO DEFAULTS", font=("Courier", 9, "bold"),
                  bg="#e2e8f0", fg="#D90429", relief="flat",
                  command=self._reset_defaults).pack(side="right", padx=8)

        tk.Button(bot, text="💾  SAVE CHANGES", font=("Courier", 11, "bold"),
                  bg="#06D6A0", fg="#000000", relief="flat", padx=16, pady=6,
                  activebackground="#04a87e",
                  command=self._save).pack(side="right", padx=8)

    # ── Build one tab (may contain multiple section cards) ──────────────────

    def _build_tab(self, parent, section_list):
        canvas = tk.Canvas(parent, bg="#f8fafc", highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        inner = tk.Frame(canvas, bg="#f8fafc")
        inner_id = canvas.create_window((0, 0), window=inner, anchor="nw")

        def _on_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))
            canvas.itemconfig(inner_id, width=canvas.winfo_width())

        inner.bind("<Configure>", _on_configure)
        canvas.bind("<Configure>", lambda e: canvas.itemconfig(inner_id, width=canvas.winfo_width()))

        # Mouse wheel scrolling
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        for section_header, config_key in section_list:
            self._build_section_card(inner, section_header, config_key)

    # ── Build one section card (e.g. "Shooting & Efficiency") ───────────────

    def _build_section_card(self, parent, header, config_key):
        card = tk.Frame(parent, bg="white",
                        highlightbackground="#000000", highlightthickness=2)
        card.pack(fill="x", padx=12, pady=8, ipady=4)

        # Header strip
        hdr = tk.Frame(card, bg="#000000")
        hdr.pack(fill="x")
        tk.Label(hdr, text=header.upper(), bg="#000000", fg="#FFD166",
                 font=("Courier", 10, "bold"), pady=6, padx=10,
                 anchor="w").pack(fill="x")

        # Column labels
        col_frame = tk.Frame(card, bg="#f1f5f9")
        col_frame.pack(fill="x")
        tk.Label(col_frame, text="ON/OFF", width=7, bg="#f1f5f9",
                 font=("Courier", 8, "bold"), fg="#555555").pack(side="left", padx=(8,0))
        tk.Label(col_frame, text="STAT NAME", bg="#f1f5f9",
                 font=("Courier", 8, "bold"), fg="#555555").pack(side="left", padx=8)
        tk.Label(col_frame, text="ORDER ▲▼", width=12, bg="#f1f5f9",
                 font=("Courier", 8, "bold"), fg="#555555",
                 anchor="e").pack(side="right", padx=8)

        # Rows container
        rows_frame = tk.Frame(card, bg="white")
        rows_frame.pack(fill="x", padx=4, pady=4)

        # Store row widgets so we can re-render after reorder
        self._render_section_rows(rows_frame, config_key)

    # ── Render (or re-render) stat rows for a section ───────────────────────

    def _render_section_rows(self, rows_frame, config_key):
        # Clear existing rows
        for w in rows_frame.winfo_children():
            w.destroy()

        section = self.config_data.get(config_key, [])
        section.sort(key=lambda e: e["order"])

        for idx, entry in enumerate(section):
            stat_id = entry["id"]
            label   = STAT_LABELS.get(stat_id, stat_id)
            enabled = entry["enabled"]
            is_first = (idx == 0)
            is_last  = (idx == len(section) - 1)

            row = tk.Frame(rows_frame, bg="#ffffff" if idx % 2 == 0 else "#f8fafc",
                           pady=2)
            row.pack(fill="x")

            # Toggle checkbox
            var = tk.BooleanVar(value=enabled)

            def _toggle(v=var, k=config_key, s=stat_id):
                for e in self.config_data[k]:
                    if e["id"] == s:
                        e["enabled"] = v.get()
                self._mark_unsaved()

            chk = tk.Checkbutton(row, variable=var, command=_toggle,
                                 bg=row["bg"], activebackground=row["bg"],
                                 selectcolor="#06D6A0")
            chk.pack(side="left", padx=(8, 2))

            # Stat label
            color = "#000000" if enabled else "#aaaaaa"
            tk.Label(row, text=label, bg=row["bg"],
                     font=("Courier", 9, "bold" if enabled else "normal"),
                     fg=color, anchor="w").pack(side="left", padx=6, fill="x", expand=True)

            # Move down button
            def _move_down(k=config_key, i=idx, rf=rows_frame):
                sec = self.config_data[k]
                sec.sort(key=lambda e: e["order"])
                if i < len(sec) - 1:
                    sec[i]["order"], sec[i+1]["order"] = sec[i+1]["order"], sec[i]["order"]
                    self._mark_unsaved()
                    self._render_section_rows(rf, k)

            # Move up button
            def _move_up(k=config_key, i=idx, rf=rows_frame):
                sec = self.config_data[k]
                sec.sort(key=lambda e: e["order"])
                if i > 0:
                    sec[i]["order"], sec[i-1]["order"] = sec[i-1]["order"], sec[i]["order"]
                    self._mark_unsaved()
                    self._render_section_rows(rf, k)

            btn_style = dict(font=("Courier", 8, "bold"), relief="flat",
                             width=3, pady=1)

            tk.Button(row, text="▼", bg="#e2e8f0", fg="#000000",
                      state="disabled" if is_last else "normal",
                      command=_move_down, **btn_style).pack(side="right", padx=2)
            tk.Button(row, text="▲", bg="#e2e8f0", fg="#000000",
                      state="disabled" if is_first else "normal",
                      command=_move_up, **btn_style).pack(side="right", padx=2)

    # ── Save / reset ────────────────────────────────────────────────────────

    def _mark_unsaved(self):
        self._unsaved = True
        self.status_lbl.config(text="⚠  Unsaved changes — click SAVE CHANGES.",
                               fg="#D90429")

    def _save(self):
        try:
            save_config(self.config_data)
            self._unsaved = False
            self.status_lbl.config(
                text="✓  Saved!  Rebuild the app: cd CAC-test-main && npm run build",
                fg="#06D6A0")
        except Exception as ex:
            messagebox.showerror("Save Failed", str(ex))

    def _reset_defaults(self):
        if not messagebox.askyesno("Reset to Defaults",
                "This will re-enable all stats and restore original order.\nContinue?"):
            return

        defaults = {
            "summary": [
                "summary_possession","summary_xg","summary_shots_sot",
                "summary_pass_accuracy","summary_fouls",
            ],
            "attack_shooting": [
                "attack_goals","attack_shots_on_target","attack_shots_inside_box",
                "attack_shots_outside_box","attack_avg_shot_distance",
                "attack_xg","attack_xg_per_shot","attack_xg_overperformance",
            ],
            "attack_distribution": [
                "attack_assists","attack_key_passes","attack_total_passes",
                "attack_progressive_passes","attack_through_balls","attack_crosses",
            ],
            "attack_ball_progression": [
                "attack_total_carries","attack_progressive_carries",
                "attack_carries_final_third","attack_dribbles",
            ],
            "attack_pressure": [
                "attack_shots_under_pressure","attack_pass_acc_under_pressure",
            ],
            "defense_tackling": [
                "defense_total_tackles","defense_tackles_succ_failed",
                "defense_tackles_gaining_poss","defense_total_interceptions",
                "defense_interceptions_succ_failed","defense_ints_gaining_poss",
            ],
            "defense_blocks": [
                "defense_total_blocks","defense_opp_shots_blocked",
                "defense_total_clearances","defense_clearances_gaining_poss",
                "defense_own_goals",
            ],
            "defense_work_rate": [
                "defense_total_defensive_actions","defense_defensive_success_rate",
                "defense_possession_wins","defense_total_ball_recoveries",
                "defense_total_pressures",
            ],
            "defense_goalkeeping": [
                "defense_total_saves","defense_gripping_push_saves",
                "defense_total_fouls","defense_yellow_red_cards",
            ],
        }

        for section_key, ids in defaults.items():
            self.config_data[section_key] = [
                {"id": sid, "enabled": True, "order": i}
                for i, sid in enumerate(ids)
            ]

        self._mark_unsaved()

        # Rebuild all visible section rows
        for widget in self.winfo_children():
            widget.destroy()
        self._build_ui()

    def on_close(self):
        if self._unsaved:
            if not messagebox.askyesno("Unsaved Changes",
                    "You have unsaved changes. Quit without saving?"):
                return
        self.destroy()


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = StatsManager()
    app.protocol("WM_DELETE_WINDOW", app.on_close)
    app.mainloop()
