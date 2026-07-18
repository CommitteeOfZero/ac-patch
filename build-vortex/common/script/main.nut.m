(system(("script/include.nut")));
(system(("script/title.nut")));
((::System).setVariableFrame((true)));
(SELECTDIALOG_MOTION <- ("motion/select.psb"));
(CONFIRMDIALOG_MOTION <- ("motion/dialog.psb"));
(ENVPLAYER_MSGWIN_MOTION <- ("motion/main.psb"));
(ENVPLAYER_SELECT_MOTION <- ("motion/envselect.psb"));
(ENVPLAYER_SUBMSGWIN_MOTION <- ("motion/main.psb"));
{
    local bounds = ((::System).getScreenBounds());
    (printf(("render resolution: %d x %d\n"), ((bounds).width), ((bounds).height)));
    local date = ((::System).getLocalDateTime());
    (::srand((((((date).hour) * (3600)) + (((date).min) * (60))) + ((date).sec))))
};
(system(("script/spec.nut")));
(specSetup());
(system(("script/exception.nut")));
(system(("script/util.nut")));
(system(("script/init.nut")));

system("script/c0override.nut");

(setexceptionclass((::Exception)));
(printf(("startup vargc:%s\n"), (vargc)));
local params = ([
]);
local defines = ([
]);
local args = ({
});
local cnt = (0);
for (; (cnt) < (vargc);) {
    local param = (vargv[cnt]);
    switch (param) {
    case "-s":
        (cnt++);
        if ((cnt) < (vargc)) {
            ((args).startScene <- (vargv[cnt]))
        };
        break;
    case "-l":
        (cnt++);
        if ((cnt) < (vargc)) {
            ((args).startLine <- ((((vargv[cnt]).charAt((0))) == ("*")) ? (vargv[cnt]) : (tonumber((vargv[cnt])))))
        };
        break;
    case "-m":
        (cnt++);
        if ((cnt) < (vargc)) {
            ((args).startState <- (vargv[cnt]))
        };
        break;
    case "-a":
        (::allSeen <- (true));
        break;
    case "-ne":
        ((args).noEffect <- (true));
        break;
    case "-f":
        ((args).allSkip <- (true));
        break;
    case "-debug":
        (::setdebughook((::debughook)));
        break;
    case "-D":
        (cnt++);
        if ((cnt) < (vargc)) {
            ((defines).append((vargv[cnt])))
        };
        break;
    default:
        ((params).append((param)));
    };
    (cnt++)
};
((args).params <- (params));
((args).defines <- (defines));
(gameMain((args), (((::init) != (null)) ? ((::init).root) : (null))))
