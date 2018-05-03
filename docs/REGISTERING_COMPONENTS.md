# Registering Components

## Introduction

While you were going through the [Getting Started](GETTING_STARTED.md) section, you already learnt 
that we need to tell inceptum about the controllers and services before we write them. 

In this section, we will describe different ways of registering such components with inceptum.

There are two basic approaches to do this. 

### Approach 1: Provide the directory url 
The first way is trivial. Provide inceptum with the directory name and inceptum will recursively travel 
through the directory to register all modules in that directory. 

```js
app.addDirectory(path.resolve(`${__dirname}/controller`));
```

In fact, this is the approach we followed
in the [Getting Started](GETTING_STARTED.md) section. 

However, this approach can be troublesome, if you decide to mix your controllers or services with other 
modules. 

For instance, if you decide to keep your tests alongside the source files, inceptum will assume
the tests as source files. 

```
controller
├── JobController.ts
├── PageController.ts
├── SalesController.ts
└── __tests__
    ├── JobController.test.js
    ├── PageController.test.js
    └── SalesController.test.js
```

Another scenario is when you follow a component based architecture and decide to
keep all related services, controllers, views etc. together in a directory.

```
modules
├── job
│   ├── config
│   ├── jobController
│   ├── jobService
│   └── jobView
├── page
│   ├── config
│   ├── pageController
│   ├── pageService
│   └── pageView
└── sales
│   ├── config
│   ├── salesController
│   ├── salesService
│   └── salesView
```

Thus inceptum now supports glob patterns for the `addDirectory` method, allowing you to tackle these scenarios.

### Approach 2: Glob Patterns
 
To address these problems, we introduced glob pattern matching to the `addDirectory` method. 
Thus for the above example scenarios, we can use the following commands to match only the controllers.

*Please see the Advanced Usage section for more details on how to use glob patterns.*

##### Ignore recursive `__test__` directories
```js
app.addDirectory([
    path.resolve(`${__dirname}/controller`), 
    '!**/__test__'
]);
```

##### Match only controllers
```js
app.addDirectory(path.resolve(`${__dirname}/modules/**/*Controller.js`))
```

## Advanced usage

In above examples, how did we instruct inceptum to use direct matching, or glob pattern matching? 
Well, there are few ways to tell inceptum about the approach it should take. 

### Conventions
Most of the times, Inceptum is intelligent enough to pick the suitable approach for pattern matching based on first argument you
supply to the `addDirectory` method. The available conventions can be listed down as follows,

Note that the conventions are purely based on the first argument, i.e. `path` argument of the `addDirectory` method,

1. When the path is a string, and contains at least one of the magic characters={}, then inceptum will treat it 
as a glob pattern.
1. When the argument is an array of strings, then inceptum will treat all the string patterns as glob patterns.
1. When the argument is a string, and does not contain any magic characters, then inceptum will treat the path
as a normal string path. *Here, you can force inceptum to treat the path as a glob using the `isGlob` option as
explained in the next section.*

##### Here is a quick overview of the magic characters and their usage

* `*` matches any number of characters, but not /
* `?` matches a single character, but not /
* `**` matches any number of characters, including /, as long as it's the only thing in a path part
* `{}` allows for a comma-separated list of "or" expressions
* `!` at the beginning of a pattern will negate the match


### isGlob option
The `addDirectory` method takes an optional options argument to configure its usage. The `isGlob` attribute can
be used to force inceptum to treat the path as a glob. However, it is usually not required to do so. You might
need to think twice before using this option. Anyways, the usage is as follows,

```js
app.addDirectory(path.resolve(`${__dirname}/controller`), { 
    isGlob: true 
});
```

### Customizing glob matching
Inceptum internally uses the `npm globby` library to do glob matching. Thus, we allow configuring the `globby`
usage via the second argument of the `addDirectory` method. The usage is as follows,

```js
app.addDirectory(path.resolve(`${__dirname}/modules/**/*Controller.js`), { 
    globOptions: {
        gitignore: true // Respect ignore patterns in .gitignore files that apply to the globbed files.
    }
});
```

See the [https://github.com/sindresorhus/globby#options](globby options) to see more details on globOptions available.
