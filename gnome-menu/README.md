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
      "command": "gnome-disks"
    },
    "separator": {
      "type": "separator"
    },
    "about": {
      "label": "About this system",
      "type": "built_in",
      "link": "showAbout"
    }
  }
}
```

Supported item types:

- `app`: launches `command` (or `link` for compatibility) as a program and
  arguments, without invoking a shell.
- `built_in`: calls a supported extension action named by `link`:
  `showAbout`, `showAppGrid`, or `openRecentItems`.
- `appgrid`: opens the GNOME app grid.
- `recents`: opens the recent-items location.
- `separator`: inserts a separator.

`icon` is an icon name from the active icon theme. The extension and
`menu.json` must remain in the same directory.

When creating an installable bundle, include the configuration file:

```sh
gnome-extensions pack --extra-source=menu.json gnome-menu
```
