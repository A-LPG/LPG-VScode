import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import lpg.runtime.IAst;
import lpg.runtime.ILexStream;
import lpg.runtime.IPrsStream;
import lpg.runtime.IToken;

/**
 * Reflective LPG Java testrig: lexer(char[]) → parser → JSON tokens + AST.
 *
 * Usage:
 *   java -cp lpg-runtime.jar:classes:. LpgTestRig \
 *     --lexer FQCN --parser FQCN --input path/to/file
 *
 * Or omit --lexer/--parser to auto-pick unique *Lexer / *Parser from classpath
 * by scanning --classes-dir for .class names (simple heuristic via args).
 */
public class LpgTestRig {
    public static void main(String[] args) {
        String lexerFqcn = null;
        String parserFqcn = null;
        String inputPath = null;
        String classesDir = null;
        try {
            for (int i = 0; i < args.length; i++) {
                if ("--lexer".equals(args[i]) && i + 1 < args.length) {
                    lexerFqcn = args[++i];
                } else if ("--parser".equals(args[i]) && i + 1 < args.length) {
                    parserFqcn = args[++i];
                } else if ("--input".equals(args[i]) && i + 1 < args.length) {
                    inputPath = args[++i];
                } else if ("--classes-dir".equals(args[i]) && i + 1 < args.length) {
                    classesDir = args[++i];
                }
            }
            if (inputPath == null) {
                fail("missing --input <file>");
                return;
            }
            if ((lexerFqcn == null || parserFqcn == null) && classesDir != null) {
                String[] found = discoverClasses(classesDir);
                if (lexerFqcn == null) {
                    lexerFqcn = found[0];
                }
                if (parserFqcn == null) {
                    parserFqcn = found[1];
                }
            }
            if (lexerFqcn == null || parserFqcn == null) {
                fail("missing --lexer / --parser (or --classes-dir for discovery)");
                return;
            }

            byte[] bytes = Files.readAllBytes(Paths.get(inputPath));
            String text = new String(bytes, StandardCharsets.UTF_8);
            char[] chars = text.toCharArray();

            Class<?> lexerClass = Class.forName(lexerFqcn);
            Class<?> parserClass = Class.forName(parserFqcn);

            Object lexer = lexerClass
                    .getConstructor(char[].class, String.class)
                    .newInstance(chars, inputPath);
            Method getILexStream = lexerClass.getMethod("getILexStream");
            ILexStream lexStream = (ILexStream) getILexStream.invoke(lexer);

            Object parser = parserClass.getConstructor(ILexStream.class).newInstance(lexStream);
            Method getIPrsStream = parserClass.getMethod("getIPrsStream");
            IPrsStream prsStream = (IPrsStream) getIPrsStream.invoke(parser);

            Method lexerMethod = lexerClass.getMethod("lexer", IPrsStream.class);
            lexerMethod.invoke(lexer, prsStream);

            Method parserMethod = parserClass.getMethod("parser");
            Object root = parserMethod.invoke(parser);

            List<Map<String, Object>> tokens = dumpTokens(prsStream, parser);
            Map<String, Object> tree = null;
            if (root instanceof IAst) {
                tree = dumpAst((IAst) root, new int[] { 0 });
            }

            Map<String, Object> out = new LinkedHashMap<String, Object>();
            out.put("ok", root != null);
            out.put("tokens", tokens);
            out.put("tree", tree);
            out.put("error", root == null ? "parse failed (null AST)" : null);
            System.out.println(toJson(out));
            System.exit(root != null ? 0 : 2);
        } catch (Throwable t) {
            Map<String, Object> out = new LinkedHashMap<String, Object>();
            out.put("ok", Boolean.FALSE);
            out.put("tokens", new ArrayList<Object>());
            out.put("tree", null);
            out.put("error", exceptionText(t));
            System.out.println(toJson(out));
            System.exit(1);
        }
    }

    private static void fail(String msg) {
        Map<String, Object> out = new LinkedHashMap<String, Object>();
        out.put("ok", Boolean.FALSE);
        out.put("tokens", new ArrayList<Object>());
        out.put("tree", null);
        out.put("error", msg);
        System.out.println(toJson(out));
        System.exit(1);
    }

    /** Returns [lexerFqcn, parserFqcn]. */
    private static String[] discoverClasses(String classesDir) throws Exception {
        List<String> lexers = new ArrayList<String>();
        List<String> parsers = new ArrayList<String>();
        Path root = Paths.get(classesDir);
        Files.walk(root)
                .filter(p -> p.toString().endsWith(".class"))
                .filter(p -> !p.getFileName().toString().contains("$"))
                .forEach(p -> {
                    String rel = root.relativize(p).toString().replace(File.separatorChar, '.');
                    if (!rel.endsWith(".class")) {
                        return;
                    }
                    String fqcn = rel.substring(0, rel.length() - 6);
                    String simple = fqcn.substring(fqcn.lastIndexOf('.') + 1);
                    if (simple.endsWith("KWLexer")) {
                        return;
                    }
                    if (simple.endsWith("Lexer")) {
                        lexers.add(fqcn);
                    } else if (simple.endsWith("Parser") && !simple.endsWith("prs") && !simple.contains("prs")) {
                        // JsonParserprs is a table class ending with prs not Parser
                        parsers.add(fqcn);
                    }
                });
        // Filter table helpers: *prs, *sym already excluded by not ending Lexer/Parser correctly
        List<String> realParsers = new ArrayList<String>();
        for (String p : parsers) {
            String simple = p.substring(p.lastIndexOf('.') + 1);
            if (simple.endsWith("Parser")) {
                realParsers.add(p);
            }
        }
        if (lexers.size() != 1 || realParsers.size() != 1) {
            throw new IllegalStateException(
                    "expected exactly one Lexer and one Parser class, found lexers="
                            + lexers + " parsers=" + realParsers);
        }
        return new String[] { lexers.get(0), realParsers.get(0) };
    }

    private static List<Map<String, Object>> dumpTokens(IPrsStream prs, Object parser) {
        List<Map<String, Object>> list = new ArrayList<Map<String, Object>>();
        Method kindName = null;
        try {
            kindName = parser.getClass().getMethod("getTokenKindName", int.class);
        } catch (NoSuchMethodException ignored) {
        }
        int size = prs.getSize();
        // Skip adjunct/bad token at 0 when present; dump all stream tokens.
        for (int i = 1; i < size; i++) {
            IToken tok = prs.getTokenAt(i);
            if (tok == null) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            int kind = tok.getKind();
            m.put("kind", Integer.valueOf(kind));
            String name = null;
            if (kindName != null) {
                try {
                    name = String.valueOf(kindName.invoke(parser, Integer.valueOf(kind)));
                } catch (Exception ignored) {
                }
            }
            m.put("name", name != null ? name : ("#" + kind));
            m.put("lexeme", tok.toString());
            m.put("start", Integer.valueOf(tok.getStartOffset()));
            m.put("end", Integer.valueOf(tok.getEndOffset()));
            list.add(m);
        }
        return list;
    }

    private static Map<String, Object> dumpAst(IAst node, int[] idSeq) {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        int id = idSeq[0]++;
        m.put("id", Integer.valueOf(id));
        String type = node.getClass().getSimpleName();
        m.put("type", type);
        String name = type;
        try {
            String text = node.toString();
            if (text != null && text.length() > 0 && text.length() < 80 && !text.contains("\n")) {
                name = type + ": " + text;
            }
        } catch (Exception ignored) {
        }
        m.put("name", name);
        m.put("symbol", type);
        Map<String, Object> range = new LinkedHashMap<String, Object>();
        try {
            IToken left = node.getLeftIToken();
            IToken right = node.getRightIToken();
            if (left != null) {
                range.put("start", Integer.valueOf(left.getStartOffset()));
                range.put("startLine", Integer.valueOf(left.getLine()));
                range.put("startColumn", Integer.valueOf(left.getColumn()));
            }
            if (right != null) {
                range.put("end", Integer.valueOf(right.getEndOffset()));
                range.put("endLine", Integer.valueOf(right.getEndLine()));
                range.put("endColumn", Integer.valueOf(right.getEndColumn()));
            }
        } catch (Exception ignored) {
        }
        m.put("range", range);
        List<Object> children = new ArrayList<Object>();
        // parent_saved=off throws from getChildren(); walk IAst fields instead.
        try {
            @SuppressWarnings("rawtypes")
            ArrayList kids = node.getChildren();
            if (kids != null) {
                for (Object kid : kids) {
                    if (kid instanceof IAst) {
                        children.add(dumpAst((IAst) kid, idSeq));
                    }
                }
            }
        } catch (Throwable ignored) {
            for (java.lang.reflect.Field f : node.getClass().getDeclaredFields()) {
                try {
                    f.setAccessible(true);
                    Object val = f.get(node);
                    if (val instanceof IAst) {
                        children.add(dumpAst((IAst) val, idSeq));
                    } else if (val instanceof List) {
                        for (Object item : (List<?>) val) {
                            if (item instanceof IAst) {
                                children.add(dumpAst((IAst) item, idSeq));
                            }
                        }
                    }
                } catch (Exception ignored2) {
                }
            }
        }
        m.put("children", children);
        return m;
    }

    private static String exceptionText(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null) {
            c = c.getCause();
        }
        StringWriter sw = new StringWriter();
        c.printStackTrace(new PrintWriter(sw));
        String s = c.toString();
        String stack = sw.toString();
        if (stack.length() > 2000) {
            stack = stack.substring(0, 2000) + "...";
        }
        return s + "\n" + stack;
    }

    // Minimal JSON writer (no deps).
    private static String toJson(Object o) {
        if (o == null) {
            return "null";
        }
        if (o instanceof String) {
            return "\"" + escape((String) o) + "\"";
        }
        if (o instanceof Number || o instanceof Boolean) {
            return o.toString();
        }
        if (o instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) o;
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : map.entrySet()) {
                if (!first) {
                    sb.append(",");
                }
                first = false;
                sb.append("\"").append(escape(e.getKey())).append("\":").append(toJson(e.getValue()));
            }
            sb.append("}");
            return sb.toString();
        }
        if (o instanceof List) {
            List<?> list = (List<?>) o;
            StringBuilder sb = new StringBuilder();
            sb.append("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) {
                    sb.append(",");
                }
                sb.append(toJson(list.get(i)));
            }
            sb.append("]");
            return sb.toString();
        }
        return "\"" + escape(String.valueOf(o)) + "\"";
    }

    private static String escape(String s) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }
}
