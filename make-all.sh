#!/bin/bash

install_ext(){
    while [ $1 ]; do
        if [ -d "${1}" ]; then
            cd $1 && make && make zip && mv *.zip ..
        fi
        shift
    done
    return 0
}

install_ext gnome-tint gnome-menu