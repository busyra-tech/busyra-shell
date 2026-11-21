//! Jendela utama: sidebar + tab (Beranda disematkan, lalu satu tab per sesi terminal).

use adw::prelude::*;
use gtk::{gio, glib};

use crate::ctx::{App, Ctx};
use crate::{hosts, keychain, onboarding, snippets, terminal, theme};

/// Halaman sidebar MVP: (id, judul, ikon).
const SECTIONS: [(&str, &str, &str); 3] = [
    ("hosts", "Hosts", "network-server-symbolic"),
    ("keychain", "Keychain", "dialog-password-symbolic"),
    ("snippets", "Snippets", "accessories-text-editor-symbolic"),
];

pub fn build(app: &adw::Application) {
    let window = adw::ApplicationWindow::builder()
        .application(app)
        .title("Djie Shell")
        .default_width(1200)
        .default_height(780)
        .width_request(360)
        .height_request(320)
        .build();
    let ctx = App::new(window.clone());

    let main = build_main(&ctx);
    ctx.root.add_named(&main, Some("main"));
    onboarding::show_start(&ctx);
    install_shortcuts(app, &ctx);
    window.present();
}

fn build_main(ctx: &Ctx) -> gtk::Widget {
    // ---- Sidebar ----
    let sidebar_box = gtk::Box::new(gtk::Orientation::Vertical, 0);

    let brand = gtk::Box::new(gtk::Orientation::Horizontal, 10);
    brand.set_margin_start(14);
    brand.set_margin_end(14);
    brand.set_margin_top(6);
    brand.set_margin_bottom(10);
    brand.append(&theme::logo(30));
    let names = gtk::Box::new(gtk::Orientation::Vertical, 0);
    let n1 = gtk::Label::builder().label("Djie Shell").xalign(0.0).build();
    n1.add_css_class("djie-brand");
    let n2 = gtk::Label::builder().label("SSH Client").xalign(0.0).build();
    n2.add_css_class("djie-hint");
    names.append(&n1);
    names.append(&n2);
    brand.append(&names);

    let list = gtk::ListBox::new();
    list.add_css_class("navigation-sidebar");
    list.add_css_class("djie-sidebar");
    for (_, title, icon) in SECTIONS {
        let row = gtk::Box::new(gtk::Orientation::Horizontal, 12);
        row.append(&gtk::Image::from_icon_name(icon));
        row.append(&gtk::Label::new(Some(title)));
        list.append(&row);
    }
    let c = ctx.clone();
    list.connect_row_activated(move |_, row| {
        if let Some((id, _, _)) = SECTIONS.get(row.index() as usize) {
            c.show_page(id);
        }
    });
    list.connect_row_selected(|_, _| {});
    let list_scroll = gtk::ScrolledWindow::builder().vexpand(true).hscrollbar_policy(gtk::PolicyType::Never).child(&list).build();

    let soon = gtk::Label::new(Some("SFTP, Database, Docker, Dashboard, Tim, dan sync Google menyusul di versi Linux."));
    soon.add_css_class("djie-hint");
    soon.set_wrap(true);
    soon.set_xalign(0.0);
    soon.set_margin_start(14);
    soon.set_margin_end(14);
    soon.set_margin_bottom(8);

    let lock = gtk::Button::builder().icon_name("system-lock-screen-symbolic").tooltip_text("Kunci vault (Ctrl+Shift+L)").build();
    lock.add_css_class("flat");
    let c = ctx.clone();
    lock.connect_clicked(move |_| onboarding::lock(&c));
    let footer = gtk::Box::new(gtk::Orientation::Horizontal, 6);
    footer.set_margin_start(10);
    footer.set_margin_end(10);
    footer.set_margin_bottom(10);
    let local_label = gtk::Label::builder().label("Vault lokal").xalign(0.0).hexpand(true).build();
    local_label.add_css_class("djie-hint");
    footer.append(&local_label);
    footer.append(&lock);

    sidebar_box.append(&brand);
    sidebar_box.append(&list_scroll);
    sidebar_box.append(&soon);
    sidebar_box.append(&footer);

    let sidebar_view = adw::ToolbarView::new();
    let sh = adw::HeaderBar::new();
    sh.set_show_title(false);
    sidebar_view.add_top_bar(&sh);
    sidebar_view.set_content(Some(&sidebar_box));

    // ---- Halaman di tab Beranda ----
    ctx.pages.add_named(&hosts::build(ctx), Some("hosts"));
    ctx.pages.add_named(&keychain::build(ctx), Some("keychain"));
    ctx.pages.add_named(&snippets::build(ctx), Some("snippets"));
    // Sorot baris sidebar sesuai halaman
    let l = list.clone();
    ctx.pages.connect_visible_child_name_notify(move |s| {
        let name = s.visible_child_name().map(|n| n.to_string()).unwrap_or_default();
        if let Some(i) = SECTIONS.iter().position(|(id, _, _)| *id == name) {
            l.select_row(l.row_at_index(i as i32).as_ref());
        }
    });
    list.select_row(list.row_at_index(0).as_ref());

    let home = ctx.tabs.append_pinned(&ctx.pages);
    home.set_title("Beranda");
    home.set_icon(Some(&gio::ThemedIcon::new("view-grid-symbolic")));
    home.set_tooltip("Daftar host (Ctrl+0)");
    *ctx.home.borrow_mut() = Some(home);

    let c = ctx.clone();
    ctx.tabs.connect_close_page(move |view, page| {
        if c.home.borrow().as_ref() == Some(page) {
            view.close_page_finish(page, false);
        } else {
            terminal::close_page(&c, page);
            view.close_page_finish(page, true);
        }
        glib::Propagation::Stop
    });

    // ---- Area konten ----
    let header = adw::HeaderBar::new();
    let tab_bar = adw::TabBar::builder().view(&ctx.tabs).autohide(false).expand_tabs(false).build();
    header.set_title_widget(Some(&tab_bar));

    let local_btn = gtk::Button::builder().icon_name("utilities-terminal-symbolic").tooltip_text("Terminal lokal (Ctrl+Shift+T)").build();
    let c = ctx.clone();
    local_btn.connect_clicked(move |_| terminal::open_local(&c));
    header.pack_start(&local_btn);

    let snippet_btn = gtk::MenuButton::builder().icon_name("accessories-text-editor-symbolic").tooltip_text("Jalankan snippet di tab ini").build();
    let popover = gtk::Popover::new();
    snippet_btn.set_popover(Some(&popover));
    {
        let c = ctx.clone();
        let pop = popover.clone();
        popover.connect_show(move |_| fill_snippet_popover(&c, &pop));
    }
    header.pack_end(&snippet_btn);
    // Tombol snippet hanya untuk tab terminal
    let b = snippet_btn.clone();
    let c = ctx.clone();
    ctx.tabs.connect_selected_page_notify(move |_| {
        b.set_sensitive(terminal::active_session(&c).is_some());
        if let Some(s) = terminal::active_session(&c) {
            s.term.grab_focus();
        }
    });
    snippet_btn.set_sensitive(false);

    let content = adw::ToolbarView::new();
    content.add_top_bar(&header);
    content.set_content(Some(&ctx.tabs));

    let split = adw::OverlaySplitView::builder()
        .sidebar(&sidebar_view)
        .content(&content)
        .min_sidebar_width(200.0)
        .max_sidebar_width(240.0)
        .build();

    // Sidebar jadi overlay di jendela sempit
    let toggle = gtk::ToggleButton::builder().icon_name("sidebar-show-symbolic").tooltip_text("Sidebar").visible(false).build();
    split.bind_property("show-sidebar", &toggle, "active").bidirectional().sync_create().build();
    split.bind_property("collapsed", &toggle, "visible").sync_create().build();
    header.pack_start(&toggle);
    let bp = adw::Breakpoint::new(adw::BreakpointCondition::new_length(adw::BreakpointConditionLengthType::MaxWidth, 760.0, adw::LengthUnit::Sp));
    bp.add_setter(&split, "collapsed", Some(&true.to_value()));
    ctx.window.add_breakpoint(bp);

    split.upcast()
}

fn fill_snippet_popover(ctx: &Ctx, popover: &gtk::Popover) {
    let list = gtk::ListBox::new();
    list.add_css_class("boxed-list");
    list.set_selection_mode(gtk::SelectionMode::None);
    let snippets = ctx.snippets();
    if snippets.is_empty() {
        let l = gtk::Label::new(Some("Belum ada snippet"));
        l.add_css_class("djie-muted");
        l.set_margin_top(12);
        l.set_margin_bottom(12);
        l.set_margin_start(12);
        l.set_margin_end(12);
        popover.set_child(Some(&l));
        return;
    }
    for s in snippets {
        let row = adw::ActionRow::builder().title(glib::markup_escape_text(&s.label)).subtitle(glib::markup_escape_text(&s.command)).activatable(true).build();
        row.set_subtitle_lines(1);
        let (c, pop, cmd) = (ctx.clone(), popover.clone(), s.command.clone());
        row.connect_activated(move |_| {
            pop.popdown();
            if let Some(sess) = terminal::active_session(&c) {
                sess.send(&format!("{cmd}\n"));
            }
        });
        list.append(&row);
    }
    let scroll = gtk::ScrolledWindow::builder().child(&list).propagate_natural_height(true).max_content_height(400).min_content_width(320).build();
    popover.set_child(Some(&scroll));
}

fn install_shortcuts(app: &adw::Application, ctx: &Ctx) {
    let add = |name: &str, accels: &[&str], f: Box<dyn Fn()>| {
        let a = gio::SimpleAction::new(name, None);
        a.connect_activate(move |_, _| f());
        app.add_action(&a);
        app.set_accels_for_action(&format!("app.{name}"), accels);
    };
    let unlocked = {
        let c = ctx.clone();
        move || c.vault().is_some()
    };
    let (c, u) = (ctx.clone(), unlocked.clone());
    add("local-terminal", &["<Control><Shift>t"], Box::new(move || if u() { terminal::open_local(&c) }));
    let (c, u) = (ctx.clone(), unlocked.clone());
    add("home", &["<Control>0"], Box::new(move || if u() { c.show_page("hosts") }));
    let (c, u) = (ctx.clone(), unlocked.clone());
    add("lock", &["<Control><Shift>l"], Box::new(move || if u() { onboarding::lock(&c) }));
    let (c, u) = (ctx.clone(), unlocked.clone());
    add("new-host", &["<Control><Shift>n"], Box::new(move || if u() { crate::editor::open(&c, None) }));
    let (c, u) = (ctx.clone(), unlocked.clone());
    add("close-tab", &["<Control><Shift>w"], Box::new(move || {
        if u() {
            if let Some(s) = terminal::active_session(&c) {
                if let Some(p) = s.page() {
                    c.tabs.close_page(&p);
                }
            }
        }
    }));
    // Ctrl+1..9 → tab terminal ke-n
    for i in 1..=9u32 {
        let c = ctx.clone();
        add(&format!("tab-{i}"), &[&format!("<Control>{i}")], Box::new(move || {
            let n = c.tabs.n_pages();
            if (i as i32) < n {
                c.tabs.set_selected_page(&c.tabs.nth_page(i as i32));
            }
        }));
    }
}
