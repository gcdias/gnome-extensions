#!/bin/bash

cd bing-n-tint
make
make zip
mv *.zip ..
cd ../gnome-menu
make
make zip
mv *.zip ..
cd ..
