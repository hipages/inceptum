Typescript Base
====

This is a base project you can use to create your Typescript projects.

This is what we use at [hipages](https://www.hipages.com.au) for our internal projects.

Benefits
-------

In this project we're managing all the basics that are needed for a Typescript project:
- tsc configuration
- tslint configuration
- basic devDependencies required for a typescript project
- if you're using Visual Studio Code we even include definitions for a "`tsc`" task that will watch and compile `.ts` files as they are modified.
- best-practice pre-commit, pre-publish and other git hooks. Etc.

But beyond all that the real benefit is that as we refine our standard more and more it'll be very easy to update all your projects to the latest version with a simple couple of `git` commands.

How to setup - Empty project
-------

The easiest way to use it is if you are starting a project from scratch. Simply follow these instructions:

```
$ mkdir project-name
$ cd project-name
$ git init
$ git remote add typescript-base git@github.com:hipages/typescript-base.git
$ git pull typescript-base master
$ vi package.json  # Edit the necessary elements of the project definition
$ yarn install # Or npm install... whatever you prefer... I prefer yarn
```

How to setup - Existing project
-------

If you have an existing typescript project there'll be a one-time pain of merging conflicts, but once you're done you're set for life!

```
$ cd project-name
$ git remote add typescript-base git@github.com:hipages/typescript-base.git
$ git pull --allow-unrelated-histories typescript-base master
$ # Resolve all the conflicts... which there will be
$ git commit -a -m "Moved to typescript-base"
$ yarn install # Or npm install... whatever you prefer... I prefer yarn
```

Hot to update my project to the latest project definition
---
Ok, you did what you had to do and now you've realised that we decided to do something a bit different. How do you update your project?  **Simple!**

```
$ cd project-name
$ git pull typescript-base master
```

Chances are that that's all you'll need to do. In case there's a conflict... fix it :P