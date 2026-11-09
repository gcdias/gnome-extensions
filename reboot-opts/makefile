EXTNAME = reboot-opts
EXTENSION_UUID = $(EXTNAME)@gcdias
INSTALL_PATH = ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)
FILES = extension.js metadata.json

install:
	rm -rf $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)/schemas
	cp $(FILES) $(INSTALL_PATH)
	@echo "Installed '$(EXTNAME)' to $(INSTALL_PATH)"
	@echo "Please restart GNOME Shell (logout/login) to apply changes."

zip:
	zip -r -FS $(EXTNAME).zip $(FILES) schemas

uninstall:
	rm -rf $(INSTALL_PATH)
