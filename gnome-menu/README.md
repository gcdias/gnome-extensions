# GNOME Menu

GNOME Menu adds one top-panel menu for each top-level object in `menu.json`.
Edit that file and use the Reload menus button in preferences to apply changes.

The first time the extension starts, it copies the bundled `menu.json` to
`~/.cache/gnome-menu@gcdias/menu.json` and uses that cached file. Preferences
can open the cached file in the default text editor or remove it to restore the
bundled configuration on the next menu reload.
Preferences can also generate `wpa.json` from `.desktop` launchers in
`~/.local/share/applications`. The file is saved to
`~/.cache/gnome-menu@gcdias/wpa.json` and maps each launcher ID to an `app`
item. Menu configuration errors are appended to
`~/.cache/gnome-menu@gcdias/menu-errors.log` and can be opened from preferences.

Each menu contains item IDs mapped to item objects:

```json
{
  "Devices": {
    "disks": {
      "label": "Disks",
      "icon": "org.gnome.DiskUtility",
      "type": "app",
      "command": "gnome-disks",
      "break": true
    },
    "about": {
      "label": "About this system",
      "type": "built_in",
      "link": "showAbout"
    }
  }
}
```

A menu name prefixed with `&` uses a matching SVG icon from
`https://gcdias.github.io/ubuntu-setup/res/icons/grub-os-symb/`, based on the
remaining name (for example, `&Ubuntu` loads `ubuntu.svg`). Icons are cached in
the user's cache directory, and `#111` fills are changed to the menu's
theme color (`#111` for dark mode, `#eee` for light mode). The icon is sized to
fit the top panel. If no matching icon is available, the menu name is shown
without the `&` prefix.

Supported item types:

- `app`: launches `command` (or `link` for compatibility) as a program and
  arguments, without invoking a shell.
- `built_in`: calls a supported extension action named by `link`:
  `showAbout`, `showAppGrid`, `openRecentItems`, `systemSuspend`,
  `minimizeWindows`, or `closeWindows`. The window actions apply to application
  windows (including dialogs) on all workspaces.
- `recents`: opens the recent-items location.
- `uri`: opens `link` in Nautilus. Links beginning with `~/` are resolved
  relative to the user's home directory.
- `break: true` on an item inserts a separator after that item.

`icon` is an icon name from the active icon theme.

When creating an installable bundle, include the configuration file:

```sh
gnome-extensions pack --extra-source=menu.json gnome-menu
```
