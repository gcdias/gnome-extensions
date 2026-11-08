EXTNAME = bing-n-tint
EXTENSION_UUID = $(EXTNAME)@gcdias
INSTALL_PATH = ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)
FILES = extension.js utils/logger.js utils/utils.js wp/wp-engine.js wp/bing.js wp/picsum.js wp/wiki.js wp/nasa.js metadata.json stylesheet.src gtk.css prefs.js bing-symbolic.svg
SCHEMA = schemas/org.gnome.shell.extensions.$(EXTNAME).gschema.xml

install:
	rm -rf $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)/schemas $(INSTALL_PATH)/utils $(INSTALL_PATH)/wp
	cp $(filter-out utils/% wp/%,$(FILES)) $(INSTALL_PATH)
	cp utils/logger.js utils/utils.js $(INSTALL_PATH)/utils
	cp wp/wp-engine.js wp/bing.js wp/picsum.js wp/wiki.js wp/nasa.js $(INSTALL_PATH)/wp
	cp $(SCHEMA) $(INSTALL_PATH)/schemas
	glib-compile-schemas $(INSTALL_PATH)/schemas
	@echo "Installed '$(EXTNAME)' to $(INSTALL_PATH)"
	@echo "Please restart GNOME Shell (logout/login) to apply changes."

zip:
	zip -r -FS $(EXTNAME).zip $(FILES) schemas

uninstall:
	rm -rf $(INSTALL_PATH)
