import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function getMenuConfigErrorLogFile(uuid) {
  const cacheDirectory = Gio.File.new_for_path(GLib.build_filenamev([
    GLib.get_user_cache_dir(),
    uuid,
  ]));
  return cacheDirectory.get_child('menu-errors.log');
}

export function recordMenuConfigError(uuid, context, error) {
  try {
    const logFile = getMenuConfigErrorLogFile(uuid);
    const parent = logFile.get_parent();
    if (!parent.query_exists(null))
      parent.make_directory_with_parents(null);

    const stream = logFile.append_to(Gio.FileCreateFlags.NONE, null);
    try {
      const timestamp = GLib.DateTime.new_now_local().format('%Y-%m-%d %H:%M:%S');
      const message = error?.message ?? String(error);
      const [success] = stream.write_all(
        new TextEncoder().encode(`[${timestamp}] ${context}: ${message}\n`),
        null,
      );
      if (!success)
        throw new Error('Could not write configuration error log entry');
    } finally {
      stream.close(null);
    }
  } catch (writeError) {
    logError(writeError, 'GNOME Menu: unable to write configuration error log');
  }
}
