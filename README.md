# Introduction

Inceptum is hipages' microservice framework.

It lets you quickly create production ready microservices quickly and easily, getting features such as logging, monitoring 
and metrics for free.

#Core Concepts

##Lifecycle

##Inversion of Control

At it's core, incpetum is just the glue that binds different parts of your application. It does this by implemention a powerful
inversion of control (IoC) container that is responsible for doing all the "plumbing" for you. Your class will ask inceptum for a database
connection, it inceptum will worry about instaniting any classes or resources that you need.



##Plugins

Inceptum does nothing on is own, almost all functionaility is provided, including internally by **plugins**. Plugins allow
you to hook into the lifecycle of your app and add functionaility to your app. Plugins are described more TODO.



