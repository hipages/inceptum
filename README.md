# Inceptum – Enterprise Node.js Framework

[![Build Status](https://travis-ci.org/hipages/inceptum.svg?branch=master)](https://travis-ci.org/hipages/inceptum)
[![codecov](https://codecov.io/gh/hipages/inceptum/branch/master/graph/badge.svg)](https://codecov.io/gh/hipages/inceptum)

## What is it?
Inceptum is a framework built at [hipages](https://www.homeimprovementpages.com.au/) to support our move towards microservices.

## Why?
The move to microservices may or may not make sense for your company. In our case as our Engineering team keeps on growing we feel that having clear ownership boundaries of different parts of the system will be beneficial.

But the microservices journey is filled with a lot of operational complexities:
* Multiple moving pieces that make debugging more difficult,
* Cascading failure across dependencies,
* Monitoring of multiple applications,
* and many, many more.

It is for this reason that we wanted to embed as many operational concerns as possible into a common framework that would power all of our microservices. This is where `Inceptum` comes in.

## What do you get?
These are some of the benefits of using `Inceptum` to build your apps:
* Typescript ready: Javascript is a great language, and [V8](https://developers.google.com/v8/) (which powers [Node.js](https://nodejs.org/en/)) is a great engine with outstanding performance. But [Typescript](http://www.typescriptlang.org/) is better! Having a strongly typed language can prove very beneficial in preventing difficult to find errors.
* Inversion of Control (IoC): Inspired by the [Spring Framework](https://spring.io/) and the support for Decorators, you can use annotations like `@Autowire` or `@AutowireConfig` to inject the necessary dependencies in your classes. This provides much better testability and isolation of concerns.
* Use of [express.js](https://expressjs.com): Built from the ground up to support Rest/HTTP microservices and APIs, it has a sensible setup for express.
* DB enabled: With support for MySQL and Postgress built in, you can easily start integrating DBs in your apps in a matter of seconds.
* Solid logging framework: Based on Bunyan, `Inceptum` makes logging management easy, it allows for easy configuration of log levels per logger and stream.
* [Swagger/OpenAPI](https://swagger.io/) enabled: Because API support is critical in microservices and documentation is hard. Swagger/OpenAPI solves for those two problems and `Inceptum` makes it easy by allowing you to easily route endpoints specified in the swagger file to controllers defined in the context.
* [Prometheus](https://prometheus.io/) enabled: Understanding how your app is doing is critical for successful operations of your microservices. `Inceptum` is heavily instrumented using Prometheus and will, out of the box gather and publish: all the basic node metrics, http requests metrics, db connection pools metrics, and many more.
* [New Relic](https://newrelic.com/) enabled: You can very easily use New Relic as your APM to gain insights of your app.
* Health Checks Enabled: A typical miss on many frameworks, your app will automatically expose a health check endpoint that will show whether your app is running properly. If you use a DB, RabbitMQ, or other backend provided by `Inceptum`, each of them will register a health check automatically.

And many more

## So, how mature is `Inceptum`

We're currently using `Inceptum` in production supporting more than 5 microservices and the number is growing by the day. We're very close to reaching a 1.0.0 release and we have put quite a bit of effort into test coverage (it could be better, and you can help us ;).

Most importantly, though, there's a lot of commitment from the hipages Engineering team to keep supporting and building the framework as we continue our move to microservices.

## How do I get started?
You can check the online documentation available in [https://inceptum.io](https://inceptum.io).

## Questions, issues, etc?
Please open your tickets in [Github](https://github.com/hipages/inceptum/issues). 
