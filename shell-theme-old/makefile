EXTENSION_UUID = shell-theme@gcdias
INSTALL_PATH = ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)
FILES = extension.js metadata.json stylesheet.css prefs.js
SCHEMA = schemas/org.gnome.shell.extensions.shell-theme.gschema.xml

install:
	rm -rf $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)/schemas
	cp $(FILES) $(INSTALL_PATH)
	cp $(SCHEMA) $(INSTALL_PATH)/schemas
	glib-compile-schemas $(INSTALL_PATH)/schemas
	@echo "Installed 'Shell Theme' to $(INSTALL_PATH)"
	@echo "Please restart GNOME Shell (logout/login) to apply changes."

zip:
	zip -r -FS shell-theme.zip $(FILES) schemas

uninstall:
	rm -rf $(INSTALL_PATH)
