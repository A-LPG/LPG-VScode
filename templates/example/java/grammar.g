%options package=$PACKAGE_NAME$
%options template=$TEMPLATE$F.gi
%options import_terminals=$CLASS_NAME_PREFIX$Lexer.gi
$AUTO_GENERATE$
--
-- This is just a sample grammar and not yet a real grammar for $LANG_NAME$
--

%Globals
    /.

    ./
%End

%Define
    $ast_class /.Object./
    $additional_interfaces /., IParser./
%End

%Terminals
    --            
    -- Here, list aliases for terminals whose names are themselves
    -- not a valid identifier in the parser's implementation language.
    COMMA ::= ','
    SEMICOLON ::= ';'
    PLUS ::= '+'
    MINUS ::= '-'
    ASSIGN ::= '='
    TIMES ::= '*'
    DIVIDE ::= '/'
    GREATER ::= '>'
    LESS ::= '<'
    EQUAL ::= '=='
    NOTEQUAL ::= '!='
    LEFTPAREN ::= '('
    RIGHTPAREN ::= ')'
    LEFTBRACE ::= '{'
    RIGHTBRACE ::= '}'
%End

%Start
    compilationUnit
%End

%Recover
   MissingExpression
%End

%Rules
    -- In this section you list all the rules for your grammar.
    -- When reduced, each rule will produce one Ast node.
    -- 
    --  Here are some example rules:
    -- 
    compilationUnit$$functionDeclaration ::= %empty
                                           | compilationUnit functionDeclaration

    functionDeclaration ::= functionHeader block
    /.

    ./
    
    functionHeader ::= Type identifier '('$ parameters ')'$
    
    parameters$$declaration ::= %empty
                              | parameterList

    parameterList$$declaration ::= declaration
                                 | parameterList ','$ declaration
                                                            
    declaration ::= primitiveType identifier

    stmtList$$statement ::= %empty
                          | stmtList statement
    statement ::= declarationStmt
                | assignmentStmt
                | ifStmt
                | returnStmt
                | whileStmt
                | block
                | functionStmt
                | ';'$

    block ::= '{'$ stmtList '}'$
    /.

    ./

    declarationStmt ::= declaration ';'$
                      | declaration '='$ expression ';'$
                       
    Type ::= primitiveType
           | void

    primitiveType ::= boolean
                    | double
                    | int
                              
    assignmentStmt ::= identifier '='$ expression ';'$
                     | BadAssignment
    ifStmt ::= if '('$ expression ')'$ statement
             | if '('$ expression ')'$ statement else statement

    whileStmt ::= while '('$ expression ')'$ statement

    returnStmt ::= return expression ';'$

    expression ::= expression '+'$ term
                 | expression '-'$ term
                 | expression '*'$ term
                 | expression '/'$ term
                 | expression '>'$ term
                 | expression '<'$ term
                 | expression '=='$ term
                 | expression '!='$ term
                 | term
    term ::= NUMBER
           | DoubleLiteral
           | true
           | false
           | identifier
           | functionCall
           
    functionCall ::= identifier '('$ expressions ')'$

    functionStmt ::= functionCall ';'$
    
    expressions$$expression ::= %empty
                              | expressionList
    expressionList$$expression ::= expression
                                 | expressionList ','$ expression

    identifier ::= IDENTIFIER
    /.

    ./

    BadAssignment ::= identifier '='$ MissingExpression 
%End

%Headers
    /.
    
    ./
%End
