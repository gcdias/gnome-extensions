# GNOME Menu

GNOME Menu adds one top-panel menu for each top-level object in `menu.json`.
Edit that file and reload the extension to change the menus.

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
  `showAbout`, `showAppGrid`, `openRecentItems`, or `reloadExtension`.
  `reloadExtension` restarts the extension and reloads `menu.json`.
- `appgrid`: opens the GNOME app grid.
- `recents`: opens the recent-items location.
- `break: true` on an item inserts a separator after that item.

`icon` is an icon name from the active icon theme. The extension and
`menu.json` must remain in the same directory.

When creating an installable bundle, include the configuration file:

```sh
gnome-extensions pack --extra-source=menu.json gnome-menu
```
