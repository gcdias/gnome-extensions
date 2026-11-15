import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function getWPAConfig() {
  const applicationsPath = GLib.build_filenamev([
    GLib.get_user_data_dir(),
    'applications',
  ]);
  const applicationsDirectory = Gio.File.new_for_path(applicationsPath);
  const enumerator = applicationsDirectory.enumerate_children(
    'standard::name,standard::type',
    Gio.FileQueryInfoFlags.NONE,
    null,
  );
  const files = [];
  let fileInfo;
  while ((fileInfo = enumerator.next_file(null)) !== null) {
    if (fileInfo.get_file_type() === Gio.FileType.REGULAR &&
        fileInfo.get_name().endsWith('.desktop')) {
      files.push(fileInfo.get_name());
    }
  }
  enumerator.close(null);
  files.sort();

  const wpa = Object.create(null);
  for (const fileName of files) {
    const filePath = GLib.build_filenamev([applicationsPath, fileName]);
    const keyFile = new GLib.KeyFile();
    keyFile.load_from_file(filePath, GLib.KeyFileFlags.NONE);

    const desktopEntry = 'Desktop Entry';
    const fileStem = fileName.replace(/\.desktop$/, '');
    const nameParts = fileStem.split('-');
    const baseId = nameParts.length >= 3
      ? nameParts.slice(1, -1).join('-')
      : fileStem;
    let itemId = baseId;
    if (Object.hasOwn(wpa, itemId))
      itemId = `${baseId}-${nameParts.at(-1)}`;
    if (Object.hasOwn(wpa, itemId))
      itemId = `${baseId}-${nameParts[0]}-${nameParts.at(-1)}`;
    if (Object.hasOwn(wpa, itemId))
      throw new Error(`Could not create a unique WPA item ID for ${fileName}`);

    const item = {
      label: keyFile.get_locale_string(desktopEntry, 'Name', null),
      type: 'app',
    };
    const [keys] = keyFile.get_keys(desktopEntry);
    if (keys.includes('Icon')) {
      const icon = keyFile.get_string(desktopEntry, 'Icon');
      item.icon = icon.includes('/')
        ? icon.split('/').at(-1).replace(/\.[^.]+$/, '')
        : icon;
    }
    item.link = keyFile.get_string(desktopEntry, 'Exec');

    wpa[itemId] = item;
  }

  return wpa;
}
