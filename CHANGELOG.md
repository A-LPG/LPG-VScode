# Change Log

All notable changes to the "LPG-VScode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Released]
### 0.0.15
* Fixed: Get invalid generated code by having two conflicting function definitions when option -> glr is true [ in lpg generator].
* 
### 0.0.14
* Fixed: Segment fault when there are mutilple macro in Headers section [ in lpg generator].
* Add : Add linux version lpg generator.
* 
### 0.0.13
* Add : Using switch instead of if statement in Visitor.  [ in lpg generator].
* Chane template of go target to handle all the err .
* 
### 0.0.12
* Add : add go support  [ in lpg generator].
* Add : add go target template .
* Fixed: In typescript target, An interface declaration cannot have the "implements" clause. 
* Fixed: Generate  the wrong code when visitor is default . It hanpen on  python target,dart target
* Change: In dart target ,change the hierarchy model to avoid quadratic behavior. It's a issue in dart dart-lang/sdk#47024
* Change: In python2/3 target ,change the hierarchy model to avoid  the typeError Cannot create a consistent method resolution order (MRO)
* Fixed:  When visitor is preorder , the method which name  endVisit always to trow error. It happen on java target,csharp target, dart target,python2/python3 taget
* 
### 0.0.11
* Add : add python2 support  [ in lpg generator].
* Add : add python2 target template .
* Add : add dart support   [ in lpg generator].
* Add : add dart target template .
* Fixed: enter method in csharp targe isn't abstract method, remove the override modifier.[lpg generator]
* 
### 0.0.10
* Add : add python3 support in lpg generator.
* Add : add python3 target template .
* 
### 0.0.9
* Fixed: some bug in languange server.
* Add : add typescript in lpg generator.
* Add : add typescript template .
### 0.0.7
* Fixed: Call graph dind't work. For lack of d3 node-modules.
* 

### 0.0.6
* Fixed: It's wrong to dynamic registered capability twice on language server side.
* 
### 0.0.5
* Support action list after a rule.
* Fixed lpg generator bugs.
  
### 0.0.4
* fixed lpg language server bugs.
### 0.0.3
* fixed lpg generator bugs.

  
