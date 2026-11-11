EXTNAME = bing-n-tint
EXTENSION_UUID = $(EXTNAME)@gcdias
INSTALL_PATH = ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)
FILES = extension.js \
		metadata.json \
		prefs.js
RES   = res/bing-symbolic.svg \
		res/stylesheet.src \
		res/gtk.css \
		res/ptyxis.palette \
		res/user.src
UTILS = utils/logger.js \
		utils/utils.js
WALLP = wp/wp-engine.js \
		wp/bing.js \
		wp/picsum.js \
		wp/wiki.js \
		wp/nasa.js \
		wp/wall.js
SCHEMA = schemas/org.gnome.shell.extensions.$(EXTNAME).gschema.xml

install:
	rm -rf $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)/schemas $(INSTALL_PATH)/utils $(INSTALL_PATH)/wp $(INSTALL_PATH)/res
	cp $(FILES) $(INSTALL_PATH)
	cp $(RES) $(INSTALL_PATH)/res
	cp $(UTILS) $(INSTALL_PATH)/utils
	cp $(WALLP) $(INSTALL_PATH)/wp
	cp $(SCHEMA) $(INSTALL_PATH)/schemas
	glib-compile-schemas $(INSTALL_PATH)/schemas
	@echo "Installed '$(EXTNAME)' to $(INSTALL_PATH)"
	@echo "Please restart GNOME Shell (logout/login) to apply changes."

zip:
	zip -r -FS $(EXTNAME).zip $(FILES) $(RES) schemas

uninstall:
	rm -rf $(INSTALL_PATH)
