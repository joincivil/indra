#!/bin/bash
# This script should only be run from the project root of Indra
set -e

name="contracts"
repo="git@github.com:ConnextProject/$name.git"
branch="spank-stable"
root="`pwd`"
path="$root/modules/client"

if [[ ! -d "$path" ]]
then echo "Can't find $name, something ain't right, exiting" && exit
elif [[ -d "$path/.git" ]]
then echo "git history already imported, exiting" && exit
fi

mkdir -p /tmp/$name
cd /tmp/$name

if [[ -d "$name/.git" ]]
then rm -rf $name
fi

git clone $repo
cd $name
git checkout $branch
cp -r .git $path/.git