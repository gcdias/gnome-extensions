import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Pango from 'gi://Pango';
import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {
  Extension,
  gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';

const ManagerInterface = `<node>
  <interface name="org.freedesktop.login1.Manager">
    <method name="SetRebootToFirmwareSetup">
      <arg type="b" direction="in"/>
    </method>
    <method name="Reboot">
      <arg type="b" direction="in"/>
    </method>
  </interface>
</node>`;

const Manager = Gio.DBusProxy.makeProxyWrapper(ManagerInterface);

export default class RebootOptsExtension extends Extension {

    constructor(metadata) {
        super(metadata);
    }

    _modifySystemItem(){
        this.menu = panel.statusArea.quickSettings?._system?.quickSettingsItems[0].menu;

        this.proxy = Manager(Gio.DBus.system, 'org.freedesktop.login1', '/org/freedesktop/login1',);

        this.rebootToUefiItem = new PopupMenu.PopupMenuItem(
            `${_('Restart to UEFI')}...`,
        );

        this.rebootToUefiItem.connect('activate', () => {
            this.counter = 60;
            this.seconds = this.counter;

            const dialog = this.buildDialog();
            dialog.open();

            this.counterIntervalId = setInterval(() => {
                if (this.counter > 0) {
                    this.counter--;
                    if (this.counter % 10 === 0) {
                        this.seconds = this.counter;
                    }
                } else {
                    this._clearIntervals();
                    this._reboot();
                }
            }, 1000);
        });

        this.menu.addMenuItem(this.rebootToUefiItem, 2);
    }

  _queueModifySystemItem(){
    this.sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      if (!panel.statusArea.quickSettings?._system)
        return GLib.SOURCE_CONTINUE;
      this._modifySystemItem();
      return GLib.SOURCE_REMOVE;
    });
  }

  enable() {
    if (!panel.statusArea.quickSettings?._system) {
      this._queueModifySystemItem();
    } else {
      this._modifySystemItem();
    }
  }

  disable() {
    this._clearIntervals();
    this.rebootToUefiItem?.destroy();
    this.rebootToUefiItem = null;
    this.proxy = null;
    if (this.sourceId) {
      GLib.Source.remove(this.sourceId);
      this.sourceId = null;
    }
  }

  _reboot(){
    this.proxy?.SetRebootToFirmwareSetupRemote(true);
    this.proxy?.RebootRemote(false);
  }

  _buildDialog(){
    const dialog = new ModalDialog.ModalDialog({ styleClass: 'modal-dialog' });
    dialog.setButtons([
      {
        label: _('Cancel'),
        action: () => {
          this.clearIntervals();
          dialog.close();
        },
        key: Clutter.KEY_Escape,
        default: false,
      },
      {
        label: _('Restart'),
        action: () => {
          this.clearIntervals();
          this.reboot();
        },
        default: false,
      },
    ]);

    const dialogTitle = new St.Label({
      text: _('Restart to UEFI'),
      // style_class: 'dialog-title' // TODO investigate why css classes are not working
      style: 'font-weight: bold;font-size:18px',
    });

    let dialogMessage = new St.Label({
      text: this.getDialogMessageText(),
    });
    dialogMessage.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
    dialogMessage.clutterText.lineWrap = true;

    const titleBox = new St.BoxLayout({
      xAlign: Clutter.ActorAlign.CENTER,
    });
    titleBox.add_child(new St.Label({ text: '  ' }));
    titleBox.add_child(dialogTitle);

    let box = new St.BoxLayout({ yExpand: true, vertical: true });
    box.add_child(titleBox);
    box.add_child(new St.Label({ text: '  ' }));
    box.add_child(dialogMessage);

    this.messageIntervalId = setInterval(() => {
      dialogMessage?.set_text(this.getDialogMessageText());
    }, 500);

    dialog.contentLayout.add_child(box);

    return dialog;
  }

  _getDialogMessageText(){
    return _(`The system will restart automatically in %d seconds.`).replace('%d', String(this.seconds),);
  }

  _clearIntervals(){
    clearInterval(this.counterIntervalId);
    clearInterval(this.messageIntervalId);
  }
}