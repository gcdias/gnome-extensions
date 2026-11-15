import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {
  gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';

const APPLICATION_WINDOW_TYPES = new Set([
  Meta.WindowType.NORMAL,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  Meta.WindowType.TOOLBAR,
  Meta.WindowType.UTILITY,
  Meta.WindowType.SPLASHSCREEN,
]);

export function getBuiltInActions(extension) {
  return new Map([
    ['openRecentItems', () => openRecentItems()],
    ['reloadExtension', () => reloadExtension(extension)],
    ['showAbout', () => showAbout()],
    ['showAppGrid', () => showAppGrid()],
    ['minimizeWindows', () => minimizeWindows()],
    ['closeWindows', () => closeWindows()],
    ['systemSuspend', () => systemSuspend()],
  ]);
}

export function openRecentItems() {
  Gio.AppInfo.launch_default_for_uri('recent:///', null);
}

export function reloadExtension(extension) {
  const manager = Main.extensionManager;
  if (!manager.disableExtension(extension.uuid))
    throw new Error(_('The extension could not be disabled'));

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
    try {
      if (!manager.enableExtension(extension.uuid))
        throw new Error(_('The extension could not be enabled'));
    } catch (error) {
      logError(error, 'GNOME Menu: failed to restart the extension');
      Main.notifyError(
        _('Unable to reload the GNOME Menu extension'),
        error.message,
      );
    }

    return GLib.SOURCE_REMOVE;
  });
}

export function showAbout() {
  launchCommand('gnome-control-center system');
}

export function showAppGrid() {
  Main.overview.showApps();
}

export function minimizeWindows() {
  for (const window of getApplicationWindows())
    window.minimize();
}

export function closeWindows() {
  const timestamp = global.get_current_time();
  for (const window of getApplicationWindows())
    window.delete(timestamp);
}

export function systemSuspend() {
  Gio.DBus.system.call(
    'org.freedesktop.login1',
    '/org/freedesktop/login1',
    'org.freedesktop.login1.Manager',
    'Suspend',
    new GLib.Variant('(b)', [true]),
    null,
    Gio.DBusCallFlags.NONE,
    -1,
    null,
    (bus, result) => {
      try {
        bus.call_finish(result);
      } catch (error) {
        logError(error, 'Could not suspend');
      }
    },
  );
}

function getApplicationWindows() {
  return global.get_window_actors()
    .map(actor => actor.get_meta_window())
    .filter(window => APPLICATION_WINDOW_TYPES.has(window.get_window_type()));
}

function launchCommand(command) {
  const [success, argv] = GLib.shell_parse_argv(command);
  if (!success || argv.length === 0)
    throw new Error(`Invalid command: ${command}`);

  Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
}

export function countDown(title, message, action, seconds = 60) {
  const dialog = new ModalDialog.ModalDialog({ styleClass: 'modal-dialog' });
  let dialogMessage;
  let counterIntervalId;
  let messageIntervalId;

  const getDialogMessageText = () =>
    _(`${message} in ${seconds} seconds.`);

  const clearIntervals = () => {
    clearInterval(counterIntervalId);
    clearInterval(messageIntervalId);
  };

  dialog.setButtons([
    {
      label: _('Cancel'),
      action: () => {
        clearIntervals();
        dialog.close();
      },
      key: Clutter.KEY_Escape,
      default: false,
    },
    {
      label: _(title),
      action: () => {
        clearIntervals();
        dialog.close();
        action();
      },
      default: false,
    },
  ]);

  const dialogTitle = new St.Label({
    text: _(title),
    style: 'font-weight: bold;font-size:18px',
  });

  dialogMessage = new St.Label({ text: getDialogMessageText() });
  dialogMessage.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
  dialogMessage.clutterText.lineWrap = true;

  const titleBox = new St.BoxLayout({
    xAlign: Clutter.ActorAlign.CENTER,
  });
  titleBox.add_child(new St.Label({ text: '  ' }));
  titleBox.add_child(dialogTitle);

  const box = new St.BoxLayout({ yExpand: true, vertical: true });
  box.add_child(titleBox);
  box.add_child(new St.Label({ text: '  ' }));
  box.add_child(dialogMessage);

  messageIntervalId = setInterval(() => {
    dialogMessage.set_text(getDialogMessageText());
  }, 500);

  dialog.contentLayout.add_child(box);

  dialog.open();
  counterIntervalId = setInterval(() => {
    if (seconds > 0) {
      seconds--;
    } else {
      clearIntervals();
      dialog.close();
      action();
    }
  }, 1000);
}
