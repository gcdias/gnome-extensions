import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function getCachedMenuConfigFile(uuid) {
  const cacheDirectory = Gio.File.new_for_path(GLib.build_filenamev([
    GLib.get_user_cache_dir(),
    uuid,
  ]));
  return [cacheDirectory, cacheDirectory.get_child('menu.json')];
}

function copyMenuConfig(source, destinationDirectory, destination) {
  if (!destinationDirectory.query_exists(null))
    destinationDirectory.make_directory_with_parents(null);
  source.copy(destination, Gio.FileCopyFlags.NONE, null, null);
}

export function getMenuConfigFile(extensionPath, uuid, settings) {
  const [cacheDirectory, cachedConfig] = getCachedMenuConfigFile(uuid);
  const bundledConfig = Gio.File.new_for_path(GLib.build_filenamev([
    extensionPath,
    'menu.json',
  ]));

  if (!settings.get_boolean('menu-config-initialized')) {
    if (!cachedConfig.query_exists(null)) {
      const legacyPath = settings.get_string('menu-file');
      const source = legacyPath
        ? Gio.File.new_for_path(legacyPath)
        : bundledConfig;
      copyMenuConfig(source, cacheDirectory, cachedConfig);
    }
    settings.set_boolean('menu-config-initialized', true);
  }

  return cachedConfig.query_exists(null) ? cachedConfig : bundledConfig;
}

export function getEditableMenuConfigFile(extensionPath, uuid, settings) {
  getMenuConfigFile(extensionPath, uuid, settings);
  const [cacheDirectory, cachedConfig] = getCachedMenuConfigFile(uuid);
  if (cachedConfig.query_exists(null))
    return cachedConfig;

  const bundledConfig = Gio.File.new_for_path(GLib.build_filenamev([
    extensionPath,
    'menu.json',
  ]));
  copyMenuConfig(bundledConfig, cacheDirectory, cachedConfig);
  return cachedConfig;
}

export function resetMenuConfigFile(uuid, settings) {
  const [, cachedConfig] = getCachedMenuConfigFile(uuid);
  if (cachedConfig.query_exists(null) && !cachedConfig.delete(null))
    throw new Error(`Could not remove ${cachedConfig.get_path()}`);

  settings.set_boolean('menu-config-initialized', true);
}

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
